// 파일 1개 업로드 실행기 — 저장은 반드시 FilesApi 시그니처로만 (헌법 4.2, integration.ts 5장)
// intent → 서명 URL 업로드(진행률, F5) → finalize → createPhoto. 의존성 주입으로 테스트한다.
// runUploadItemWithRetry: 네트워크 실패만 자동으로 다시 (F6). files 행·사진 행 id 를 재사용하므로 중복 행이 없다
import type { PhotoPhase } from '@/shared/contracts/domain';
import type { ActionResult } from '@/shared/contracts/errors';
import type { FilesApi } from '@/shared/contracts/integration';
import { withRetry, type RetryOptions } from './retry';
import type { QueueAction, UploadItem } from './upload-queue';

export interface CommonInput {
  projectId: string;
  companyId: string;
  phase: PhotoPhase;
  /** 비우면 사진별 EXIF 촬영일 (POL-022: 사용자 입력 우선) */
  capturedOn: string | null;
  description: string;
  isPublic: boolean;
}

export interface PipelineDeps {
  createUploadIntent: FilesApi['createUploadIntent'];
  finalizeUpload: FilesApi['finalizeUpload'];
  upload(
    bucket: string,
    path: string,
    token: string,
    file: File,
    onProgress: (fraction: number) => void,
  ): Promise<{ ok: true } | { ok: false; alreadyExists: boolean }>;
  createPhoto(input: {
    id: string;
    projectId: string;
    fileId: string;
    thumbFileId: string | null;
    phase: PhotoPhase;
    capturedOn: string | null;
    description: string;
    isPublic: boolean;
  }): Promise<ActionResult<{ id: string }>>;
}

export async function runUploadItem(
  item: UploadItem,
  file: File,
  common: CommonInput,
  deps: PipelineDeps,
  dispatch: (a: QueueAction) => void,
): Promise<void> {
  const key = item.key;
  try {
    let { fileId, intent } = item;

    // ① 업로드 의도 (기존 files 행이 있으면 재사용 — 중복 행 없음)
    if (!fileId || !intent) {
      dispatch({ type: 'stage', key, stage: 'uploading' });
      const res = await deps.createUploadIntent({
        kind: 'photo_original',
        projectId: common.projectId,
        companyId: common.companyId,
        fileName: item.name,
        sizeBytes: item.size,
        mime: item.mime,
      });
      if (!res.ok) {
        dispatch({
          type: 'fail',
          key,
          error: { kind: 'code', code: res.error.code, ref: res.error.ref },
        });
        return;
      }
      fileId = res.data.fileId;
      intent = { bucket: res.data.bucket, path: res.data.path, token: res.data.token };
      dispatch({ type: 'patch', key, patch: { fileId, intent } });
    }

    // ② 서명 URL 업로드 (재시도 때 이미 올라간 객체면 통과)
    dispatch({ type: 'stage', key, stage: 'uploading' });
    const up = await deps.upload(intent.bucket, intent.path, intent.token, file, (progress) =>
      dispatch({ type: 'progress', key, progress }),
    );
    if (!up.ok && !up.alreadyExists) {
      dispatch({ type: 'fail', key, error: { kind: 'network' } });
      return;
    }

    // ③ 서버 확인 (형식 헤더·디코딩·재인코딩·EXIF 제거)
    dispatch({ type: 'stage', key, stage: 'finalizing' });
    const fin = await deps.finalizeUpload(fileId);
    if (!fin.ok) {
      dispatch({
        type: 'fail',
        key,
        error: { kind: 'code', code: fin.error.code, ref: fin.error.ref },
      });
      return;
    }
    if (fin.data.status === 'rejected') {
      dispatch({
        type: 'fail',
        key,
        error: { kind: 'reject', reason: fin.data.rejectReason ?? 'corrupt' },
        needsNewFile: true,
      });
      return;
    }
    const thumbFileId = fin.data.thumbFileId ?? null;
    dispatch({
      type: 'patch',
      key,
      patch: { thumbFileId, serverCapturedOn: fin.data.capturedOn ?? null },
    });

    // ④ 사진 행 연결 (행 id 고정 → 재시도해도 1행)
    dispatch({ type: 'stage', key, stage: 'saving' });
    const saved = await deps.createPhoto({
      id: item.photoId,
      projectId: common.projectId,
      fileId,
      thumbFileId,
      phase: item.phase ?? common.phase,
      capturedOn: common.capturedOn ?? item.exifDate ?? fin.data.capturedOn ?? null,
      description: common.description,
      isPublic: common.isPublic,
    });
    if (!saved.ok) {
      dispatch({
        type: 'fail',
        key,
        error: { kind: 'code', code: saved.error.code, ref: saved.error.ref },
      });
      return;
    }
    dispatch({ type: 'stage', key, stage: 'done' });
  } catch {
    // 네트워크 끊김·서버 액션 호출 실패 — 입력과 성공분은 유지, 이 파일만 재시도 (NFR-008)
    dispatch({ type: 'fail', key, error: { kind: 'network' } });
  }
}

/**
 * F6: 네트워크 실패면 잠시 뒤 같은 항목을 다시 돌린다 (최신 상태의 fileId·intent 재사용).
 * 거절·권한·검증 오류는 다시 해도 같으므로 바로 실패로 남긴다
 */
export async function runUploadItemWithRetry(
  key: string,
  file: File,
  common: CommonInput,
  deps: PipelineDeps,
  dispatch: (a: QueueAction) => void,
  getItem: (key: string) => UploadItem | undefined,
  opts: Pick<RetryOptions<unknown>, 'delays' | 'sleep'> = {},
): Promise<void> {
  await withRetry(
    async () => {
      const item = getItem(key);
      if (item) await runUploadItem(item, file, common, deps, dispatch);
      return getItem(key);
    },
    {
      ...opts,
      shouldRetry: (item) => item?.stage === 'failed' && item.error?.kind === 'network',
      onRetry: (attempt) => dispatch({ type: 'autoRetry', key, attempt }),
    },
  );
}

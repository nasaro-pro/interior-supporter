// 다중 업로드 큐 상태기계 (02 문서 6.2) — 대기 → 업로드 중 → 확인 중 → 저장 중 → 완료 / 실패 → 재시도. 순수 함수.
import { FILE_RULES, type PhotoPhase } from '@/shared/contracts/domain';
import type { ErrorCode } from '@/shared/contracts/errors';
import { CONVERT_EXTS, extOf } from './image-prep';

export type UploadStage = 'queued' | 'uploading' | 'finalizing' | 'saving' | 'done' | 'failed';

export type UploadError =
  | { kind: 'code'; code: ErrorCode; ref?: string }
  | { kind: 'reject'; reason: 'type' | 'size' | 'corrupt' | 'pixels' }
  | { kind: 'network' };

export interface UploadItem {
  key: string;
  /** 사진 행 id — 큐에 넣을 때 한 번 만들고 재시도에도 유지 (POL-038) */
  photoId: string;
  name: string;
  size: number;
  mime: string;
  stage: UploadStage;
  fileId: string | null;
  thumbFileId: string | null;
  /** createUploadIntent 결과 — 버킷은 intent 가 정한다 (하드코딩하지 않음, C-07) */
  intent: { bucket: string; path: string; token: string } | null;
  /** 브라우저가 읽은 EXIF 촬영일 (제안값) */
  exifDate: string | null;
  /** finalize 가 돌려준 EXIF 촬영일 */
  serverCapturedOn: string | null;
  error: UploadError | null;
  /** 거절된 파일은 연결할 수 없으므로 재시도 때 새 파일 행이 필요 */
  needsNewFile: boolean;
  /** 사진별 공정 (F7). null 이면 공통 입력의 공정 */
  phase: PhotoPhase | null;
  /** 업로드 바이트 진행률 0~1 (F5) */
  progress: number;
  /** 자동 재시도 횟수 (F6, 표시용) */
  autoRetry: number;
}

export type QueueAction =
  | { type: 'add'; items: UploadItem[] }
  | { type: 'remove'; key: string }
  | { type: 'stage'; key: string; stage: UploadStage; patch?: Partial<UploadItem> }
  | { type: 'patch'; key: string; patch: Partial<UploadItem> }
  | { type: 'progress'; key: string; progress: number }
  | { type: 'autoRetry'; key: string; attempt: number }
  | { type: 'fail'; key: string; error: UploadError; needsNewFile?: boolean }
  | { type: 'retry'; key: string }
  | { type: 'clearDone' };

export function createUploadItem(
  file: { name: string; size: number; type: string },
  key: string,
  photoId: string,
): UploadItem {
  return {
    key,
    photoId,
    name: file.name,
    size: file.size,
    mime: file.type,
    stage: 'queued',
    fileId: null,
    thumbFileId: null,
    intent: null,
    exifDate: null,
    serverCapturedOn: null,
    error: null,
    needsNewFile: false,
    phase: null,
    progress: 0,
    autoRetry: 0,
  };
}

const RULE = FILE_RULES.photo_original;
/** 고르는 단계의 원본 상한 — 브라우저가 줄인 뒤(F4) 다시 RULE.maxBytes 로 검사한다. 메모리 보호용 */
export const RAW_MAX_BYTES = RULE.maxBytes * 3;
/** 파일 고르기 창에 보이는 확장자 = 서버 허용 + 브라우저 변환(F3) */
export const PICK_EXTS = [...RULE.exts, ...CONVERT_EXTS] as const;

/** POL-021 + F3·F4: png/jpg/jpeg/webp 와 브라우저가 JPEG 로 바꿀 gif/bmp. HEIC 미지원(안내). 크기는 원본 상한 */
export function validatePhotoFile(f: {
  name: string;
  size: number;
  type: string;
}): null | 'heic' | 'type' | 'size' {
  const ext = extOf(f.name);
  if (ext === '.heic' || ext === '.heif' || /image\/hei[cf]/i.test(f.type)) return 'heic';
  if (!(PICK_EXTS as readonly string[]).includes(ext)) return 'type';
  if (f.size <= 0 || f.size > RAW_MAX_BYTES) return 'size';
  return null;
}

/** 브라우저 준비(변환·축소) 뒤 최종 크기 검사 (POL-021 20MB) */
export const fitsUploadLimit = (size: number) => size > 0 && size <= RULE.maxBytes;

export function uploadQueueReducer(state: UploadItem[], action: QueueAction): UploadItem[] {
  const update = (key: string, fn: (i: UploadItem) => UploadItem) =>
    state.map((i) => (i.key === key ? fn(i) : i));
  switch (action.type) {
    case 'add':
      return [...state, ...action.items];
    case 'remove':
      return state.filter((i) => i.key !== action.key || i.stage === 'done' || isActive(i));
    case 'stage':
      return update(action.key, (i) => ({
        ...i,
        ...action.patch,
        stage: action.stage,
        error: null,
      }));
    case 'patch':
      return update(action.key, (i) => ({ ...i, ...action.patch }));
    case 'progress':
      return update(action.key, (i) => ({ ...i, progress: action.progress }));
    case 'autoRetry':
      return update(action.key, (i) => ({ ...i, autoRetry: action.attempt }));
    case 'fail':
      return update(action.key, (i) => ({
        ...i,
        stage: 'failed',
        error: action.error,
        needsNewFile: action.needsNewFile ?? i.needsNewFile,
      }));
    case 'retry':
      return update(action.key, (i) =>
        i.stage !== 'failed'
          ? i
          : i.needsNewFile
            ? {
                ...i,
                stage: 'queued',
                error: null,
                fileId: null,
                intent: null,
                thumbFileId: null,
                needsNewFile: false,
                progress: 0,
                autoRetry: 0,
              }
            : { ...i, stage: 'queued', error: null, progress: 0, autoRetry: 0 },
      );
    case 'clearDone':
      return state.filter((i) => i.stage !== 'done');
  }
}

export const isActive = (i: UploadItem) =>
  i.stage === 'uploading' || i.stage === 'finalizing' || i.stage === 'saving';

export function summarizeQueue(items: UploadItem[]) {
  return {
    total: items.length,
    done: items.filter((i) => i.stage === 'done').length,
    failed: items.filter((i) => i.stage === 'failed').length,
    active: items.filter(isActive).length,
    queued: items.filter((i) => i.stage === 'queued').length,
  };
}

/** 단계별 진행률 바닥값 — 업로드 단계는 바이트 진행률로 채운다 (F5) */
export const STAGE_PROGRESS: Record<UploadStage, number> = {
  queued: 0,
  uploading: 5,
  finalizing: 70,
  saving: 90,
  done: 100,
  failed: 0,
};

/** 막대에 그릴 진행률(0~100): 업로드 중이면 5~70 사이를 바이트 진행률로 */
export function itemProgress(i: Pick<UploadItem, 'stage' | 'progress'>): number {
  if (i.stage !== 'uploading') return STAGE_PROGRESS[i.stage];
  const lo = STAGE_PROGRESS.uploading;
  return Math.round(lo + (STAGE_PROGRESS.finalizing - lo) * Math.min(1, Math.max(0, i.progress)));
}

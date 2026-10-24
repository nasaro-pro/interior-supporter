import { describe, expect, it, vi } from 'vitest';
import { runUploadItem, type CommonInput, type PipelineDeps } from './upload-pipeline';
import {
  createUploadItem,
  uploadQueueReducer,
  type QueueAction,
  type UploadItem,
} from './upload-queue';

const common: CommonInput = {
  projectId: '7a9b8c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  companyId: 'c1',
  phase: 'tile',
  capturedOn: null,
  description: '',
  isPublic: false,
};
const file = new File([new Uint8Array([1, 2, 3])], 'a.jpg', { type: 'image/jpeg' });

function harness(deps: Partial<PipelineDeps>, start?: Partial<UploadItem>) {
  let state: UploadItem[] = [
    {
      ...createUploadItem({ name: 'a.jpg', size: 3, type: 'image/jpeg' }, 'k', 'photo-1'),
      ...start,
    },
  ];
  const dispatch = (a: QueueAction) => {
    state = uploadQueueReducer(state, a);
  };
  const full: PipelineDeps = {
    createUploadIntent: vi.fn(async () => ({
      ok: true as const,
      data: { fileId: 'f1', bucket: 'project-files' as const, path: 'p/f1.jpg', token: 'tok' },
    })),
    finalizeUpload: vi.fn(async () => ({
      ok: true as const,
      data: { fileId: 'f1', status: 'ready' as const, capturedOn: '2026-10-01' },
    })),
    upload: vi.fn(async () => ({ ok: true as const })),
    createPhoto: vi.fn(async () => ({ ok: true as const, data: { id: 'photo-1' } })),
    ...deps,
  };
  return {
    full,
    get: () => state[0]!,
    dispatch,
    run: () => runUploadItem(state[0]!, file, common, full, dispatch),
  };
}

describe('runUploadItem (REQ-211 · C-T03)', () => {
  it('정상: intent → 업로드 → finalize → 사진 행 1개 → done', async () => {
    const h = harness({});
    await h.run();
    expect(h.get().stage).toBe('done');
    expect(h.full.createPhoto).toHaveBeenCalledTimes(1);
    expect(h.full.createPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'photo-1', fileId: 'f1', capturedOn: '2026-10-01' }),
    );
    // C-07: 버킷은 intent 가 준 값으로 업로드한다
    expect(h.full.upload).toHaveBeenCalledWith('project-files', 'p/f1.jpg', 'tok', file);
  });

  it('촬영일은 공통 입력 > EXIF(브라우저) > 서버 EXIF 순 (POL-022)', async () => {
    const h = harness({}, { exifDate: '2026-09-30' });
    await h.run();
    expect(h.full.createPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ capturedOn: '2026-09-30' }),
    );
    const h2 = harness({}, { exifDate: '2026-09-30' });
    await runUploadItem(
      h2.get(),
      file,
      { ...common, capturedOn: '2026-10-05' },
      h2.full,
      h2.dispatch,
    );
    expect(h2.full.createPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ capturedOn: '2026-10-05' }),
    );
  });

  it('업로드 실패 후 재시도는 intent 를 다시 만들지 않는다 (files 행 재사용)', async () => {
    const upload = vi
      .fn<PipelineDeps['upload']>()
      .mockResolvedValueOnce({ ok: false, alreadyExists: false })
      .mockResolvedValueOnce({ ok: true });
    const h = harness({ upload });
    await h.run();
    expect(h.get()).toMatchObject({ stage: 'failed', fileId: 'f1', error: { kind: 'network' } });
    h.dispatch({ type: 'retry', key: 'k' });
    await h.run();
    expect(h.get().stage).toBe('done');
    expect(h.full.createUploadIntent).toHaveBeenCalledTimes(1);
  });

  it('이미 올라간 객체(재시도)는 통과시키고 finalize 로 간다', async () => {
    const h = harness({ upload: vi.fn(async () => ({ ok: false as const, alreadyExists: true })) });
    await h.run();
    expect(h.get().stage).toBe('done');
  });

  it('finalize 가 거절(rejected)하면 실패 + 재시도 때 새 intent', async () => {
    const finalizeUpload = vi
      .fn<PipelineDeps['finalizeUpload']>()
      .mockResolvedValueOnce({
        ok: true,
        data: { fileId: 'f1', status: 'rejected', rejectReason: 'corrupt' },
      })
      .mockResolvedValueOnce({ ok: true, data: { fileId: 'f1', status: 'ready' } });
    const h = harness({ finalizeUpload });
    await h.run();
    expect(h.get()).toMatchObject({
      stage: 'failed',
      error: { kind: 'reject', reason: 'corrupt' },
    });
    h.dispatch({ type: 'retry', key: 'k' });
    await h.run();
    expect(h.full.createUploadIntent).toHaveBeenCalledTimes(2);
    expect(h.get().stage).toBe('done');
  });

  it('사진 저장 실패는 오류 코드와 함께 failed (성공한 다른 파일에는 영향 없음)', async () => {
    const h = harness({
      createPhoto: vi.fn(async () => ({
        ok: false as const,
        error: { code: 'FORBIDDEN' as const, ref: 'r1' },
      })),
    });
    await h.run();
    expect(h.get()).toMatchObject({
      stage: 'failed',
      error: { kind: 'code', code: 'FORBIDDEN', ref: 'r1' },
    });
  });

  it('예외(네트워크 끊김)는 network 실패로 기록한다', async () => {
    const h = harness({
      createUploadIntent: vi.fn(async () => Promise.reject(new Error('fetch failed'))),
    });
    await h.run();
    expect(h.get()).toMatchObject({ stage: 'failed', error: { kind: 'network' } });
  });
});

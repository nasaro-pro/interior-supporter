import { describe, expect, it } from 'vitest';
import {
  createUploadItem,
  summarizeQueue,
  uploadQueueReducer,
  validatePhotoFile,
  type UploadItem,
} from './upload-queue';

const item = (key: string, patch: Partial<UploadItem> = {}): UploadItem => ({
  ...createUploadItem({ name: `${key}.jpg`, size: 1000, type: 'image/jpeg' }, key, `photo-${key}`),
  ...patch,
});

describe('validatePhotoFile (POL-021)', () => {
  it('HEIC 는 별도 안내', () => {
    expect(validatePhotoFile({ name: 'IMG_1.HEIC', size: 10, type: 'image/heic' })).toBe('heic');
    expect(validatePhotoFile({ name: 'a.heif', size: 10, type: '' })).toBe('heic');
  });
  it('허용 확장자 밖은 type, 20MB 초과는 size', () => {
    expect(validatePhotoFile({ name: 'a.gif', size: 10, type: 'image/gif' })).toBe('type');
    expect(
      validatePhotoFile({ name: 'a.jpg', size: 20 * 1024 * 1024 + 1, type: 'image/jpeg' }),
    ).toBe('size');
    expect(validatePhotoFile({ name: 'a.JPEG', size: 10, type: 'image/jpeg' })).toBeNull();
  });
});

describe('uploadQueueReducer (REQ-211)', () => {
  it('add → stage → fail → retry 에서 사진 행 id 는 유지된다 (중복 행 없음)', () => {
    let s = uploadQueueReducer([], { type: 'add', items: [item('a')] });
    s = uploadQueueReducer(s, {
      type: 'stage',
      key: 'a',
      stage: 'uploading',
      patch: { fileId: 'f1', intent: { bucket: 'project-files', path: 'p', token: 't' } },
    });
    s = uploadQueueReducer(s, { type: 'fail', key: 'a', error: { kind: 'network' } });
    expect(s[0]).toMatchObject({ stage: 'failed', fileId: 'f1' });
    s = uploadQueueReducer(s, { type: 'retry', key: 'a' });
    expect(s[0]).toMatchObject({ stage: 'queued', fileId: 'f1', photoId: 'photo-a', error: null });
  });

  it('거절된 파일은 재시도 때 새 파일 업로드가 필요하다 (fileId 초기화)', () => {
    let s = uploadQueueReducer([], { type: 'add', items: [item('a', { fileId: 'f1' })] });
    s = uploadQueueReducer(s, {
      type: 'fail',
      key: 'a',
      error: { kind: 'reject', reason: 'corrupt' },
      needsNewFile: true,
    });
    s = uploadQueueReducer(s, { type: 'retry', key: 'a' });
    expect(s[0]).toMatchObject({
      fileId: null,
      intent: null,
      photoId: 'photo-a',
      needsNewFile: false,
    });
  });

  it('완료된 항목은 빼거나 재시도할 수 없다', () => {
    let s = uploadQueueReducer([], { type: 'add', items: [item('a', { stage: 'done' })] });
    s = uploadQueueReducer(s, { type: 'remove', key: 'a' });
    s = uploadQueueReducer(s, { type: 'retry', key: 'a' });
    expect(s).toHaveLength(1);
    expect(s[0]?.stage).toBe('done');
  });

  it('대기·실패 항목은 뺄 수 있다', () => {
    let s = uploadQueueReducer([], { type: 'add', items: [item('a'), item('b')] });
    s = uploadQueueReducer(s, { type: 'remove', key: 'a' });
    expect(s.map((i) => i.key)).toEqual(['b']);
  });
});

describe('summarizeQueue', () => {
  it('완료·실패·진행 수', () => {
    expect(
      summarizeQueue([
        item('a', { stage: 'done' }),
        item('b', { stage: 'failed' }),
        item('c', { stage: 'uploading' }),
        item('d'),
      ]),
    ).toEqual({ total: 4, done: 1, failed: 1, active: 1, queued: 1 });
  });
});

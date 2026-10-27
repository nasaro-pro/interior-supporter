import { describe, expect, it, vi } from 'vitest';
import { putWithProgress, signedUploadUrl, toUploadOutcome, type XhrLike } from './signed-upload';

describe('signedUploadUrl', () => {
  it('경로 조각만 인코딩하고 토큰을 붙인다', () => {
    expect(signedUploadUrl('https://x.supabase.co/', 'photos', 'c1/p 1/a.jpg', 't+k')).toBe(
      'https://x.supabase.co/storage/v1/object/upload/sign/photos/c1/p%201/a.jpg?token=t%2Bk',
    );
  });
});

describe('toUploadOutcome', () => {
  it('2xx 성공, 409·Duplicate 는 이미 있음, 그 밖 실패', () => {
    expect(toUploadOutcome(200, '')).toEqual({ ok: true });
    expect(toUploadOutcome(409, '')).toEqual({ ok: false, alreadyExists: true });
    expect(toUploadOutcome(400, '{"statusCode":"409","error":"Duplicate"}')).toEqual({
      ok: false,
      alreadyExists: true,
    });
    expect(toUploadOutcome(404, '{"error":"Bucket does not exist"}')).toEqual({
      ok: false,
      alreadyExists: false,
    });
    expect(toUploadOutcome(500, 'oops')).toEqual({ ok: false, alreadyExists: false });
  });
});

function fakeXhr(): XhrLike & { headers: Record<string, string>; sent?: FormData } {
  const x = {
    headers: {} as Record<string, string>,
    sent: undefined as FormData | undefined,
    open: vi.fn(),
    setRequestHeader(k: string, v: string) {
      x.headers[k] = v;
    },
    send(b: FormData) {
      x.sent = b;
    },
    upload: { onprogress: null },
    onload: null,
    onerror: null,
    onabort: null,
    status: 0,
    responseText: '',
  } as XhrLike & { headers: Record<string, string>; sent?: FormData };
  return x;
}

describe('putWithProgress (F5)', () => {
  const file = new File(['abc'], 'a.jpg', { type: 'image/jpeg' });

  it('진행률을 알리고 성공으로 끝난다', async () => {
    const x = fakeXhr();
    const seen: number[] = [];
    const p = putWithProgress(
      'u',
      file,
      { 'x-upsert': 'false' },
      (f) => seen.push(f),
      () => x,
    );
    x.upload.onprogress?.({ loaded: 1, total: 4, lengthComputable: true });
    x.upload.onprogress?.({ loaded: 4, total: 4, lengthComputable: true });
    x.status = 200;
    x.onload?.();
    expect(await p).toEqual({ ok: true });
    expect(seen).toEqual([0.25, 1]);
    expect(x.open).toHaveBeenCalledWith('PUT', 'u');
    expect(x.headers['x-upsert']).toBe('false');
    expect(x.sent?.get('cacheControl')).toBe('3600');
  });

  it('네트워크 오류는 예외', async () => {
    const x = fakeXhr();
    const p = putWithProgress(
      'u',
      file,
      {},
      () => {},
      () => x,
    );
    x.onerror?.();
    await expect(p).rejects.toThrow('network');
  });
});

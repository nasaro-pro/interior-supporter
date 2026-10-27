// @vitest-environment node
// B-01 / TC-903: 파일 다운로드 라우트 — 존재 비노출 404 + no-store, 60초 서명 URL 302
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFake } from '@/features/files/testing/supabase-fake';

vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('@/shared/lib/supabase/admin', () => ({ createAdminSupabase: vi.fn() }));
vi.mock('@/shared/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  newRef: () => 'ref1234567',
}));
// 비로그인 시 307 리다이렉트를 만드는 getAccessContext 는 더 이상 쓰지 않는다 — 불리면 실패
vi.mock('@/features/core', () => ({
  getAccessContext: vi.fn(() => {
    throw new Error('getAccessContext must not be used by the download route');
  }),
}));

import { createAdminSupabase } from '@/shared/lib/supabase/admin';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { respondWithFile, SIGNED_URL_TTL_SECONDS } from './download';

const fileId = '00000000-0000-4000-8000-0000000000aa';
const readyRow = {
  id: fileId,
  bucket: 'project-files',
  path: 'c/p/design_original/x.pdf',
  original_name: '평면도.pdf',
  status: 'ready',
  mime: 'application/pdf',
};

function setup(opts: {
  user?: { id: string } | null;
  file?: unknown;
  fileError?: { code: string } | null;
}) {
  const user = createSupabaseFake(
    { files: [{ data: opts.file ?? null, error: opts.fileError ?? null }] },
    { user: opts.user === undefined ? { id: 'u1' } : opts.user },
  );
  const admin = createSupabaseFake({});
  vi.mocked(createServerSupabase).mockResolvedValue(user.client as never);
  vi.mocked(createAdminSupabase).mockReturnValue(admin.client as never);
  return { user, admin };
}

function expect404NoStore(res: Response) {
  expect(res.status).toBe(404);
  expect(res.headers.get('Cache-Control')).toBe('no-store');
  expect(res.headers.get('location')).toBeNull();
}

beforeEach(() => vi.clearAllMocks());

describe('respondWithFile (B-01, TC-903)', () => {
  it('잘못된 id 는 인증·DB 조회 없이 404 + no-store', async () => {
    const { user } = setup({});
    expect404NoStore(await respondWithFile('not-a-uuid', false));
    expect(createServerSupabase).not.toHaveBeenCalled();
    expect(user.auth.getUser).not.toHaveBeenCalled();
  });

  it('비로그인은 로그인 리다이렉트(307) 대신 404 + no-store — 유효 id 와 무효 id 가 같은 응답', async () => {
    const { user } = setup({ user: null, file: readyRow });
    const valid = await respondWithFile(fileId, false);
    expect404NoStore(valid);
    expect(user.calls).toHaveLength(0); // files 조회도 하지 않는다
    const invalid = await respondWithFile('zzz', false);
    expect(invalid.status).toBe(valid.status);
  });

  it('RLS 로 보이지 않는 파일(행 없음)은 404 + no-store', async () => {
    const { admin } = setup({ file: null });
    expect404NoStore(await respondWithFile(fileId, false));
    expect(admin.storageApi.createSignedUrl).not.toHaveBeenCalled();
  });

  it('pending·rejected 파일은 업로더에게도 404 (ready 검사 유지)', async () => {
    for (const status of ['pending', 'rejected']) {
      const { admin } = setup({ file: { ...readyRow, status } });
      expect404NoStore(await respondWithFile(fileId, false));
      expect(admin.storageApi.createSignedUrl).not.toHaveBeenCalled();
    }
  });

  it('조회 오류도 존재를 드러내지 않고 404', async () => {
    setup({ fileError: { code: '42501' } });
    expect404NoStore(await respondWithFile(fileId, false));
  });

  it('볼 수 있는 ready 파일은 60초 서명 URL 로 302 + no-store', async () => {
    const { user, admin } = setup({ file: readyRow });
    const res = await respondWithFile(fileId, false);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://storage.test/signed');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(user.hasOp('files', 'eq', ['id', fileId])).toBe(true);
    expect(admin.storageApi.createSignedUrl).toHaveBeenCalledWith(
      readyRow.path,
      SIGNED_URL_TTL_SECONDS,
      undefined,
    );
    expect(SIGNED_URL_TTL_SECONDS).toBe(60);
  });

  it('D-20 CAD·3D 등 미리보기 불가 형식은 download 요청이 없어도 항상 내려받기 서명', async () => {
    const { admin } = setup({
      file: {
        ...readyRow,
        path: 'c/p/design_original/x.dwg',
        original_name: '평면도.dwg',
        mime: 'image/vnd.dwg',
      },
    });
    await respondWithFile(fileId, false);
    expect(admin.storageApi.createSignedUrl).toHaveBeenCalledWith('c/p/design_original/x.dwg', 60, {
      download: '평면도.dwg',
    });
  });

  it('download=1 이면 원래 파일 이름으로 내려받기 서명', async () => {
    const { admin } = setup({ file: readyRow });
    await respondWithFile(fileId, true);
    expect(admin.storageApi.createSignedUrl).toHaveBeenCalledWith(readyRow.path, 60, {
      download: '평면도.pdf',
    });
  });

  it('서명 실패는 500 + no-store', async () => {
    const { admin } = setup({ file: readyRow });
    admin.storageApi.createSignedUrl.mockResolvedValueOnce({
      data: null,
      error: { message: 'boom' },
    });
    const res = await respondWithFile(fileId, false);
    expect(res.status).toBe(500);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

// D-34 · CU-07 사진 댓글 — 저장(고객 댓글 · 디자이너 답글) · 권한 · 고객별 대화 묶음
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFake, NotFoundSignal } from '@/features/requests/testing';

vi.mock('@/features/core', () => ({ requireProjectAccess: vi.fn(), getAccessContext: vi.fn() }));
vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/shared/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  newRef: () => 'ref1234567',
}));

import { getAccessContext, requireProjectAccess } from '@/features/core';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { addPhotoComment } from './server/actions';
import { listPhotoComments } from './server/queries';

const projectId = '7a9b8c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const photoId = '3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f';
const id = '6f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f';
const CUST = '00000000-0000-4000-8000-0000000000c1';
const PM = '00000000-0000-4000-8000-0000000000a1';
const base = { projectId, companyId: 'c1', companySlug: 'studio', canConfirm: false };
const customer = { ...base, as: 'customer' as const };
const editor = { ...base, as: 'editor' as const };
const ctx = (userId: string) => ({
  userId,
  displayName: 'x',
  locale: 'ko' as const,
  memberships: [],
  participations: [],
  areas: ['portal' as const],
});

function useFake(script: Parameters<typeof createSupabaseFake>[0]) {
  const fake = createSupabaseFake(script);
  vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
  return fake;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireProjectAccess).mockResolvedValue(customer);
  vi.mocked(getAccessContext).mockResolvedValue(ctx(CUST));
});

describe('addPhotoComment', () => {
  it('고객: 자기 대화(thread_owner = 본인)로 저장', async () => {
    const fake = useFake({
      photos: [{ data: { id: photoId } }],
      photo_comments: [{ error: null }],
    });
    expect(await addPhotoComment({ id, projectId, photoId, body: '벽 색 확인' })).toEqual({
      ok: true,
      data: { id },
    });
    expect(fake.argOf('photo_comments', 'insert')?.[0]).toMatchObject({
      photo_id: photoId,
      author_id: CUST,
      thread_owner: CUST,
      body: '벽 색 확인',
    });
    expect(fake.opsOf('photos')).toContainEqual({ op: 'eq', args: ['project_id', projectId] });
  });

  it('디자이너: 고객 대화에 답글 (threadOwner 필수, 자기 자신 불가)', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(editor);
    vi.mocked(getAccessContext).mockResolvedValue(ctx(PM));
    let fake = useFake({ photos: [{ data: { id: photoId } }], photo_comments: [{ error: null }] });
    await addPhotoComment({ id, projectId, photoId, body: '네', threadOwner: CUST });
    expect(fake.argOf('photo_comments', 'insert')?.[0]).toMatchObject({
      author_id: PM,
      thread_owner: CUST,
    });
    fake = useFake({});
    expect(await addPhotoComment({ id, projectId, photoId, body: '네' })).toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });
    expect(
      await addPhotoComment({ id, projectId, photoId, body: '네', threadOwner: PM }),
    ).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
    expect(fake.opsOf('photo_comments')).toHaveLength(0);
  });

  it('권한 거부: 고객이 남의 대화 → FORBIDDEN, 다른 프로젝트 사진 → NOT_FOUND, 시공팀 → notFound', async () => {
    let fake = useFake({});
    expect(
      await addPhotoComment({ id, projectId, photoId, body: 'x', threadOwner: PM }),
    ).toMatchObject({ error: { code: 'FORBIDDEN' } });
    fake = useFake({ photos: [{ data: null }] });
    expect(await addPhotoComment({ id, projectId, photoId, body: 'x' })).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
    expect(fake.opsOf('photo_comments')).toHaveLength(0);
    vi.mocked(requireProjectAccess).mockRejectedValue(new NotFoundSignal());
    await expect(addPhotoComment({ id, projectId, photoId, body: 'x' })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });

  it('예외: 빈 댓글 · 1001자 → 입력 오류, RLS 거부 → FORBIDDEN', async () => {
    useFake({});
    expect(await addPhotoComment({ id, projectId, photoId, body: '  ' })).toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });
    expect(await addPhotoComment({ id, projectId, photoId, body: 'a'.repeat(1001) })).toMatchObject(
      { error: { code: 'VALIDATION_FAILED' } },
    );
    useFake({
      photos: [{ data: { id: photoId } }],
      photo_comments: [{ error: { code: '42501', message: 'rls' } }],
    });
    expect(await addPhotoComment({ id, projectId, photoId, body: 'x' })).toMatchObject({
      error: { code: 'FORBIDDEN' },
    });
  });
});

describe('listPhotoComments', () => {
  const rows = [
    {
      id: 'c1',
      body: '질문',
      author_id: CUST,
      thread_owner: CUST,
      created_at: '2026-10-25T01:00:00Z',
    },
    { id: 'c2', body: '답', author_id: PM, thread_owner: CUST, created_at: '2026-10-25T02:00:00Z' },
    {
      id: 'c3',
      body: '다른 고객',
      author_id: 'u9',
      thread_owner: 'u9',
      created_at: '2026-10-25T03:00:00Z',
    },
  ];
  it('디자이너는 고객별 대화로 묶어 본다', async () => {
    useFake({ photo_comments: [{ data: rows }], profiles: [{ data: [] }] });
    const threads = await listPhotoComments(photoId, editor, PM);
    expect(threads.map((t) => t.ownerId)).toEqual([CUST, 'u9']);
    expect(threads[0]!.comments.map((c) => c.byOwner)).toEqual([true, false]);
  });
  it('고객은 자기 대화만 묻는다 (이중 검증), 시공팀은 DB 를 묻지 않는다', async () => {
    let fake = useFake({ photo_comments: [{ data: rows.slice(0, 2) }], profiles: [{ data: [] }] });
    await listPhotoComments(photoId, customer, CUST);
    expect(fake.opsOf('photo_comments')).toContainEqual({ op: 'eq', args: ['thread_owner', CUST] });
    fake = useFake({});
    expect(await listPhotoComments(photoId, { ...base, as: 'field' }, 'f1')).toEqual([]);
    expect(fake.opsOf('photo_comments')).toHaveLength(0);
  });
});

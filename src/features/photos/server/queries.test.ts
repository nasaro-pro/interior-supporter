// C-02 · C-03 — 업로더 선택지·사진 상세의 이중 검증 (고객 공개분·보관 조건)
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFake } from '@/features/requests/testing';

vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('@/shared/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  newRef: () => 'ref1234567',
}));
import { logger } from '@/shared/lib/logger';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { countPhotoComments, getPhoto, listPhotoUploaders } from './queries';

const projectId = '7a9b8c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const viewer = (as: 'editor' | 'customer' | 'field') => ({
  projectId,
  companyId: 'c1',
  companySlug: 'studio',
  as,
  canConfirm: false,
});
const row = (over: Record<string, unknown> = {}) => ({
  id: 'ph1',
  project_id: projectId,
  file_id: 'f1',
  thumb_file_id: null,
  phase: 'tile',
  captured_on: '2026-10-05',
  description: '벽',
  is_public: true,
  uploaded_by: 'u-pm',
  uploader_role: 'staff',
  created_at: '2026-10-07T00:00:00Z',
  archived_at: null,
  version: 1,
  ...over,
});

function useFake(script: Parameters<typeof createSupabaseFake>[0]) {
  const fake = createSupabaseFake(script);
  vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
  return fake;
}

beforeEach(() => vi.clearAllMocks());

describe('listPhotoUploaders (C-02)', () => {
  it('정상: 편집자 진행 중 탭은 보관 제외, 공개 조건 없음, 이름순', async () => {
    const fake = useFake({
      photos: [{ data: [{ uploaded_by: 'b' }, { uploaded_by: 'a' }, { uploaded_by: 'b' }] }],
      profiles: [
        {
          data: [
            { id: 'a', display_name: '가나' },
            { id: 'b', display_name: '다라' },
          ],
        },
      ],
    });
    const res = await listPhotoUploaders(projectId, viewer('editor'), { archived: false });
    expect(res).toEqual({
      items: [
        { id: 'a', name: '가나' },
        { id: 'b', name: '다라' },
      ],
      truncated: false,
    });
    expect(fake.opsOf('photos')).toContainEqual({ op: 'is', args: ['archived_at', null] });
    expect(fake.opsOf('photos').some((o) => o.args[0] === 'is_public')).toBe(false);
  });

  it('권한: 고객은 공개 사진의 업로더만 (is_public = true, 목록과 같은 조건)', async () => {
    const fake = useFake({ photos: [{ data: [] }] });
    const res = await listPhotoUploaders(projectId, viewer('customer'), { archived: false });
    expect(res.items).toEqual([]);
    expect(fake.opsOf('photos')).toContainEqual({ op: 'eq', args: ['is_public', true] });
    expect(fake.opsOf('photos')).toContainEqual({ op: 'is', args: ['archived_at', null] });
  });

  it('보관 탭이면 보관된 사진의 업로더', async () => {
    const fake = useFake({ photos: [{ data: [] }] });
    await listPhotoUploaders(projectId, viewer('editor'), { archived: true });
    expect(fake.opsOf('photos')).toContainEqual({ op: 'not', args: ['archived_at', 'is', null] });
  });

  it('예외: 1000행에서 잘리면 truncated + 경고 로그', async () => {
    const many = Array.from({ length: 1000 }, (_, i) => ({ uploaded_by: `u${i % 3}` }));
    const fake = useFake({ photos: [{ data: many }], profiles: [{ data: [] }] });
    const res = await listPhotoUploaders(projectId, viewer('field'), { archived: false });
    expect(res.truncated).toBe(true);
    expect(res.items).toHaveLength(3);
    expect(fake.opsOf('photos')).toContainEqual({ op: 'limit', args: [1000] });
    expect(logger.warn).toHaveBeenCalledWith('photos.uploaders.truncated', { projectId });
  });
});

describe('getPhoto (C-03)', () => {
  it('정상: 편집자는 보관본도 받는다 (페이지가 보관 안내)', async () => {
    const fake = useFake({
      photos: [{ data: row({ archived_at: '2026-10-07T00:00:00Z', is_public: false }) }],
      profiles: [{ data: [{ id: 'u-pm', display_name: 'PM1' }] }],
    });
    const photo = await getPhoto(projectId, 'ph1', viewer('editor'));
    expect(photo).toMatchObject({ id: 'ph1', archived: true, uploaderName: 'PM1' });
    expect(fake.opsOf('photos').some((o) => o.args[0] === 'is_public')).toBe(false);
  });

  it('권한: 고객 조회는 is_public = true 조건을 붙인다', async () => {
    const fake = useFake({ photos: [{ data: null }] });
    expect(await getPhoto(projectId, 'ph1', viewer('customer'))).toBeNull();
    expect(fake.opsOf('photos')).toContainEqual({ op: 'eq', args: ['is_public', true] });
  });

  it('권한: RLS 가 비공개 행을 돌려줘도 고객에게는 null (이중 검증)', async () => {
    useFake({ photos: [{ data: row({ is_public: false }) }] });
    expect(await getPhoto(projectId, 'ph1', viewer('customer'))).toBeNull();
  });
});

describe('countPhotoComments (D-34 · CU-07 목록 댓글 수)', () => {
  it('정상: 사진별로 센다 · 고객은 자기 대화만 (thread_owner 조건)', async () => {
    const fake = useFake({
      photo_comments: [{ data: [{ photo_id: 'ph1' }, { photo_id: 'ph1' }, { photo_id: 'ph2' }] }],
    });
    expect(await countPhotoComments(['ph1', 'ph2', 'ph3'], viewer('customer'), 'u1')).toEqual({
      ph1: 2,
      ph2: 1,
    });
    const ops = fake.opsOf('photo_comments');
    expect(ops).toContainEqual({ op: 'in', args: ['photo_id', ['ph1', 'ph2', 'ph3']] });
    expect(ops).toContainEqual({ op: 'eq', args: ['project_id', projectId] });
    expect(ops).toContainEqual({ op: 'eq', args: ['thread_owner', 'u1'] });
  });

  it('편집자는 대화 주인 조건 없이 센다', async () => {
    const fake = useFake({ photo_comments: [{ data: [] }] });
    await countPhotoComments(['ph1'], viewer('editor'), 'pm1');
    expect(fake.opsOf('photo_comments').some((o) => o.args[0] === 'thread_owner')).toBe(false);
  });

  it('시공팀이거나 사진이 없으면 조회하지 않는다', async () => {
    const fake = useFake({});
    expect(await countPhotoComments(['ph1'], viewer('field'), 'f1')).toEqual({});
    expect(await countPhotoComments([], viewer('editor'), 'pm1')).toEqual({});
    expect(fake.calls).toHaveLength(0);
  });

  it('예외: 조회 실패면 빈 결과 + 경고 로그 (목록은 그대로 보인다)', async () => {
    useFake({ photo_comments: [{ error: { code: '42501' } }] });
    expect(await countPhotoComments(['ph1'], viewer('editor'), 'pm1')).toEqual({});
    expect(logger.warn).toHaveBeenCalledWith('photos.comments.count_failed', { dbCode: '42501' });
  });
});

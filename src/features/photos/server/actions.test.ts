import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFake, NotFoundSignal } from '@/features/requests/testing';

vi.mock('@/features/core', () => ({
  requireProjectAccess: vi.fn(),
  getAccessContext: vi.fn(),
}));
vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/shared/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  newRef: () => 'ref1234567',
}));

import { getAccessContext, requireProjectAccess } from '@/features/core';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { createPhoto, setPhotoArchived, setPhotoPublic, updatePhoto } from './actions';

const projectId = '7a9b8c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const photoId = '3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f';
const fileId = '9c8b7a6d-5e4f-4321-8abc-def012345678';
const access = (as: 'editor' | 'customer' | 'field') => ({
  projectId,
  companyId: 'c1',
  companySlug: 'studio',
  as,
  canConfirm: false,
});

function useFake(script: Parameters<typeof createSupabaseFake>[0]) {
  const fake = createSupabaseFake(script);
  vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
  return fake;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccessContext).mockResolvedValue({
    userId: 'f1',
    displayName: '시공1',
    locale: 'ko',
    memberships: [],
    participations: [],
    areas: ['field'],
  });
});

const createInput = {
  id: photoId,
  projectId,
  fileId,
  thumbFileId: null,
  phase: 'tile',
  capturedOn: '2026-10-05',
  description: '욕실 벽 타일',
  isPublic: true,
};

describe('createPhoto (REQ-211, REQ-221)', () => {
  it('시공팀 업로드는 공개 입력을 무시하고 비공개로 저장한다 (POL-017)', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(access('field'));
    const fake = useFake({ photos: [{ error: null }] });
    expect(await createPhoto(createInput)).toEqual({ ok: true, data: { id: photoId } });
    expect(requireProjectAccess).toHaveBeenCalledWith(projectId, ['editor', 'field']);
    expect(fake.argOf('photos', 'insert')?.[0]).toMatchObject({
      id: photoId,
      file_id: fileId,
      is_public: false,
      uploader_role: 'field',
    });
  });

  it('편집자는 공개 여부를 정할 수 있다', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(access('editor'));
    const fake = useFake({ photos: [{ error: null }] });
    await createPhoto(createInput);
    expect(fake.argOf('photos', 'insert')?.[0]).toMatchObject({
      is_public: true,
      uploader_role: 'staff',
    });
  });

  it('재시도(23505)는 이미 저장된 사진을 성공으로 돌려준다 (중복 행 없음)', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(access('editor'));
    useFake({ photos: [{ error: { code: '23505' } }, { data: { id: photoId } }] });
    expect(await createPhoto(createInput)).toEqual({ ok: true, data: { id: photoId } });
  });

  it('남의 파일 연결은 DB 가 막는다 (file_not_owned → FORBIDDEN)', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(access('editor'));
    useFake({ photos: [{ error: { code: 'P0001', message: 'file_not_owned' } }] });
    const res = await createPhoto(createInput);
    expect(res).toEqual({ ok: false, error: { code: 'FORBIDDEN', ref: 'ref1234567' } });
  });

  it('고객은 업로드할 수 없다 (notFound)', async () => {
    vi.mocked(requireProjectAccess).mockRejectedValue(new NotFoundSignal());
    useFake({});
    await expect(createPhoto(createInput)).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

describe('updatePhoto (REQ-213, REQ-222)', () => {
  const input = {
    projectId,
    photoId,
    baseVersion: 2,
    phase: 'paint',
    capturedOn: null,
    description: '',
  };

  it('시공팀은 남이 올린 사진을 고칠 수 없다', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(access('field'));
    useFake({ photos: [{ data: { uploaded_by: 'someone-else' } }] });
    expect(await updatePhoto(input)).toEqual({ ok: false, error: { code: 'FORBIDDEN' } });
  });

  it('시공팀은 본인 사진의 공정·촬영일·설명만 고친다', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(access('field'));
    const fake = useFake({
      photos: [{ data: { uploaded_by: 'f1', archived_at: null } }, { data: { version: 3 } }],
    });
    expect(await updatePhoto(input)).toEqual({ ok: true, data: { version: 3 } });
    expect(fake.argOf('photos', 'update', 1)?.[0]).toEqual({
      phase: 'paint',
      captured_on: null,
      description: '',
    });
    // C-06: update 자체에 본인 조건 (확인~갱신 사이 TOCTOU 차단), C-04: 보관 제외
    expect(fake.opsOf('photos', 1)).toContainEqual({ op: 'eq', args: ['uploaded_by', 'f1'] });
    expect(fake.opsOf('photos', 1)).toContainEqual({ op: 'is', args: ['archived_at', null] });
  });

  it('시공팀: 확인 뒤 소유가 바뀌어 0행이면 재조회로 FORBIDDEN (C-06)', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(access('field'));
    useFake({
      photos: [
        { data: { uploaded_by: 'f1', archived_at: null } },
        { data: null },
        { data: { uploaded_by: 'someone-else', archived_at: null } },
      ],
    });
    expect(await updatePhoto(input)).toEqual({ ok: false, error: { code: 'FORBIDDEN' } });
  });

  it('시공팀: 보관된 본인 사진은 수정할 수 없다 (CONFLICT, update 없음)', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(access('field'));
    const fake = useFake({
      photos: [{ data: { uploaded_by: 'f1', archived_at: '2026-10-07T00:00:00Z' } }],
    });
    expect(await updatePhoto(input)).toEqual({ ok: false, error: { code: 'CONFLICT' } });
    expect(fake.calls.filter((c) => c.table === 'photos')).toHaveLength(1);
  });

  it('편집자 수정에는 uploaded_by 조건을 붙이지 않는다', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(access('editor'));
    const fake = useFake({ photos: [{ data: { version: 3 } }] });
    expect(await updatePhoto(input)).toEqual({ ok: true, data: { version: 3 } });
    expect(fake.opsOf('photos').some((o) => o.op === 'eq' && o.args[0] === 'uploaded_by')).toBe(
      false,
    );
    expect(fake.opsOf('photos')).toContainEqual({ op: 'is', args: ['archived_at', null] });
  });

  it('편집자 수정이 0행이면 VERSION_CONFLICT', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(access('editor'));
    useFake({ photos: [{ data: null }, { data: { uploaded_by: 'pm1', archived_at: null } }] });
    expect(await updatePhoto(input)).toEqual({ ok: false, error: { code: 'VERSION_CONFLICT' } });
  });

  it('편집자: 보관된 사진 수정은 0행 → CONFLICT (C-04)', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(access('editor'));
    useFake({
      photos: [
        { data: null },
        { data: { uploaded_by: 'pm1', archived_at: '2026-10-07T00:00:00Z' } },
      ],
    });
    expect(await updatePhoto(input)).toEqual({ ok: false, error: { code: 'CONFLICT' } });
  });

  it('없는 사진은 NOT_FOUND (존재 숨김)', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(access('editor'));
    useFake({ photos: [{ data: null }, { data: null }] });
    expect(await updatePhoto(input)).toEqual({ ok: false, error: { code: 'NOT_FOUND' } });
  });
});

describe('setPhotoPublic · setPhotoArchived (REQ-213)', () => {
  it('공개 전환은 편집자만 요청한다', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(access('editor'));
    useFake({ photos: [{ data: { version: 5 } }] });
    const res = await setPhotoPublic({ projectId, photoId, baseVersion: 4, isPublic: true });
    expect(res).toEqual({ ok: true, data: { version: 5 } });
    expect(requireProjectAccess).toHaveBeenCalledWith(projectId, ['editor']);
  });

  it('공개 전환 0행은 VERSION_CONFLICT', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(access('editor'));
    useFake({ photos: [{ data: null }, { data: { uploaded_by: 'f1', archived_at: null } }] });
    const res = await setPhotoPublic({ projectId, photoId, baseVersion: 4, isPublic: false });
    expect(res).toEqual({ ok: false, error: { code: 'VERSION_CONFLICT' } });
  });

  it('보관된 사진은 공개 전환 불가 — CONFLICT (C-04, 복원 먼저)', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(access('editor'));
    const fake = useFake({
      photos: [
        { data: null },
        { data: { uploaded_by: 'f1', archived_at: '2026-10-07T00:00:00Z' } },
      ],
    });
    const res = await setPhotoPublic({ projectId, photoId, baseVersion: 4, isPublic: true });
    expect(res).toEqual({ ok: false, error: { code: 'CONFLICT' } });
    expect(fake.opsOf('photos')).toContainEqual({ op: 'is', args: ['archived_at', null] });
  });

  it('시공팀은 공개 전환을 요청할 수 없다 (notFound)', async () => {
    vi.mocked(requireProjectAccess).mockRejectedValue(new NotFoundSignal());
    useFake({});
    await expect(
      setPhotoPublic({ projectId, photoId, baseVersion: 4, isPublic: true }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('보관은 archived_at 갱신 (삭제 없음)', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(access('editor'));
    const fake = useFake({ photos: [{ data: { version: 2 } }] });
    await setPhotoArchived({ projectId, photoId, baseVersion: 1, archived: true });
    const update = fake.argOf('photos', 'update')?.[0] as Record<string, unknown>;
    expect(Object.keys(update)).toEqual(['archived_at']);
  });
});

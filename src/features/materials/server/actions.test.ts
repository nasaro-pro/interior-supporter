// @vitest-environment node
// B-06 보관 자재 수정 거부 (확정 무효화 방지), B-08 0행 원인 구분
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFake, NotFoundSignal } from '@/features/files/testing/supabase-fake';

vi.mock('@/features/core', () => ({ requireProjectAccess: vi.fn() }));
vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/shared/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  newRef: () => 'ref1234567',
}));

import { requireProjectAccess } from '@/features/core';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { setMaterialArchived, setMaterialPublic, updateMaterial } from './actions';

const projectId = '00000000-0000-4000-8000-0000000000b1';
const id = '00000000-0000-4000-8000-0000000000a1';
const access = {
  projectId,
  companyId: 'c1',
  companySlug: 'studio',
  as: 'editor' as const,
  canConfirm: false,
};
const fields = {
  name: '타일',
  category: '',
  space: 'bathroom' as const,
  spec: '',
  quantity: null,
  unit: '',
  unitPrice: null,
  imageFileId: null,
  locationNote: '',
  description: '',
};
const update = { projectId, id, baseVersion: 2, ...fields };

function useFake(script: Parameters<typeof createSupabaseFake>[0]) {
  const fake = createSupabaseFake(script);
  vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
  return fake;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireProjectAccess).mockResolvedValue(access);
});

describe('updateMaterial (B-06·B-08)', () => {
  it('정상: 확정 → 재확인 필요로 바뀌면 reconfirm=true', async () => {
    const fake = useFake({
      materials: [
        { data: { confirm_state: 'confirmed', archived_at: null } },
        { data: { version: 3, confirm_state: 'needs_reconfirm' } },
      ],
    });
    expect(await updateMaterial(update)).toEqual({
      ok: true,
      data: { version: 3, reconfirm: true },
    });
    expect(fake.hasOp('materials', 'is', ['archived_at', null], 1)).toBe(true);
  });

  it('보관된 자재는 update 를 보내지 않고 CONFLICT (확정 무효화가 일어나지 않음)', async () => {
    const fake = useFake({
      materials: [{ data: { confirm_state: 'confirmed', archived_at: '2026-10-01T00:00:00Z' } }],
    });
    expect(await updateMaterial(update)).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(fake.callsOf('materials')).toHaveLength(1);
    expect(fake.argOf('materials', 'update')).toBeUndefined();
  });

  it('사전 조회 후 보관된 경우(경쟁)도 CONFLICT', async () => {
    useFake({
      materials: [
        { data: { confirm_state: 'none', archived_at: null } },
        { data: null },
        { data: { version: 2, archived_at: '2026-10-01T00:00:00Z' } },
      ],
    });
    expect(await updateMaterial(update)).toMatchObject({ error: { code: 'CONFLICT' } });
  });

  it('버전 다름 → VERSION_CONFLICT, 없음 → NOT_FOUND', async () => {
    useFake({
      materials: [
        { data: { confirm_state: 'none', archived_at: null } },
        { data: null },
        { data: { version: 5, archived_at: null } },
      ],
    });
    expect(await updateMaterial(update)).toMatchObject({ error: { code: 'VERSION_CONFLICT' } });
    useFake({ materials: [{ data: null }] });
    expect(await updateMaterial(update)).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('권한: 편집자가 아니면 404 (DB 호출 없음)', async () => {
    vi.mocked(requireProjectAccess).mockRejectedValue(new NotFoundSignal());
    const fake = useFake({});
    await expect(updateMaterial(update)).rejects.toThrow('NEXT_NOT_FOUND');
    expect(fake.calls).toHaveLength(0);
  });
});

describe('setMaterialPublic / setMaterialArchived', () => {
  const versioned = { projectId, id, baseVersion: 2 };
  it('보관 중 공개 전환은 CONFLICT', async () => {
    useFake({
      materials: [{ data: null }, { data: { version: 2, archived_at: '2026-10-01T00:00:00Z' } }],
    });
    expect(await setMaterialPublic({ ...versioned, isPublic: true })).toMatchObject({
      error: { code: 'CONFLICT' },
    });
  });
  it('복원은 보관된 행에도 적용, 0행이면 원인 구분', async () => {
    const fake = useFake({ materials: [{ data: { version: 3 } }] });
    expect(await setMaterialArchived({ ...versioned, archived: false })).toMatchObject({
      ok: true,
    });
    expect(fake.hasOp('materials', 'is', ['archived_at', null])).toBe(false);
    useFake({ materials: [{ data: null }, { data: { version: 7, archived_at: null } }] });
    expect(await setMaterialArchived({ ...versioned, archived: true })).toMatchObject({
      error: { code: 'VERSION_CONFLICT' },
    });
  });
});

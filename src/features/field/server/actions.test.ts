import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFake, NotFoundSignal } from '@/features/requests/testing';

vi.mock('@/features/core', () => ({ requireProjectAccess: vi.fn() }));
vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/shared/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  newRef: () => 'ref1234567',
}));

import { requireProjectAccess } from '@/features/core';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { saveFieldAccess } from './actions';

const projectId = '7a9b8c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const input = {
  projectId,
  showSchedule: true,
  showDesigns: false,
  showMaterials: true,
  photoAutoPublic: false,
};

function useFake(script: Parameters<typeof createSupabaseFake>[0]) {
  const fake = createSupabaseFake(script);
  vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
  return fake;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireProjectAccess).mockResolvedValue({
    projectId,
    companyId: 'c1',
    companySlug: 'studio',
    as: 'editor',
    canConfirm: false,
  });
});

describe('saveFieldAccess (F2·F9)', () => {
  it('담당자는 프로젝트별 설정을 upsert 한다', async () => {
    const fake = useFake({ project_field_settings: [{ error: null }] });
    expect(await saveFieldAccess(input)).toEqual({ ok: true, data: undefined });
    expect(requireProjectAccess).toHaveBeenCalledWith(projectId, ['editor']);
    expect(fake.argOf('project_field_settings', 'upsert')?.[0]).toMatchObject({
      project_id: projectId,
      show_schedule: true,
      show_designs: false,
      show_materials: true,
      photo_auto_public: false,
    });
  });

  it('잘못된 입력은 DB 에 가지 않는다', async () => {
    const fake = useFake({});
    const res = await saveFieldAccess({ ...input, showDesigns: 'yes' });
    expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
    expect(fake.calls).toHaveLength(0);
  });

  it('시공팀·고객은 저장할 수 없다 (notFound)', async () => {
    vi.mocked(requireProjectAccess).mockRejectedValue(new NotFoundSignal());
    useFake({});
    await expect(saveFieldAccess(input)).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('RLS 거부는 권한 오류로', async () => {
    useFake({ project_field_settings: [{ error: { code: '42501', message: 'rls' } }] });
    expect(await saveFieldAccess(input)).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });
});

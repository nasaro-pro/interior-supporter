// @vitest-environment node
// B-13: 확정·재확인 요청은 대상이 경로 프로젝트 소속인지 RPC 전에 확인한다 (canConfirm·revalidate 가 올바른 프로젝트 기준)
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFake } from '@/features/files/testing/supabase-fake';

vi.mock('@/features/core', () => ({ requireProjectAccess: vi.fn() }));
vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/shared/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  newRef: () => 'ref1234567',
}));

import { revalidatePath } from 'next/cache';
import { requireProjectAccess } from '@/features/core';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { confirmTarget, requestReconfirm } from './confirm-actions';

const projectId = '00000000-0000-4000-8000-0000000000b1';
const targetId = '00000000-0000-4000-8000-0000000000d1';
const customer = {
  projectId,
  companyId: 'c1',
  companySlug: 'studio',
  as: 'customer' as const,
  canConfirm: true,
};

function useFake(script: Parameters<typeof createSupabaseFake>[0]) {
  const fake = createSupabaseFake(script);
  vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
  return fake;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireProjectAccess).mockResolvedValue(customer);
});

describe('confirmTarget (B-13)', () => {
  const input = { projectId, targetType: 'materials', targetId, revision: 2 };

  it('이 프로젝트의 대상이면 RPC 를 부르고 같은 프로젝트 경로를 갱신한다', async () => {
    const fake = useFake({
      materials: [{ data: { id: targetId } }],
      'rpc:confirm_target': [{ data: 'conf1' }],
    });
    expect(await confirmTarget(input)).toEqual({ ok: true, data: { id: 'conf1' } });
    expect(fake.hasOp('materials', 'eq', ['project_id', projectId])).toBe(true);
    expect(fake.hasOp('materials', 'eq', ['id', targetId])).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith(
      `/portal/projects/${projectId}/materials/${targetId}`,
    );
  });

  it('다른 프로젝트(또는 볼 수 없는) 대상이면 RPC 없이 NOT_FOUND', async () => {
    const fake = useFake({ materials: [{ data: null }] });
    expect(await confirmTarget(input)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(fake.client.rpc).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('확정권이 없으면 DB 를 부르지 않고 FORBIDDEN', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue({ ...customer, canConfirm: false });
    const fake = useFake({});
    expect(await confirmTarget(input)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(fake.calls).toHaveLength(0);
  });

  it('소속 확인 조회 오류는 삼키지 않는다 (ref 와 함께 실패)', async () => {
    const fake = useFake({ designs: [{ error: { code: '500', message: 'x' } }] });
    expect(await confirmTarget({ ...input, targetType: 'designs' })).toMatchObject({
      ok: false,
      error: { ref: 'ref1234567' },
    });
    expect(fake.client.rpc).not.toHaveBeenCalled();
  });
});

describe('requestReconfirm (B-13)', () => {
  const input = { projectId, targetType: 'designs', targetId, reason: '도면 수정' };
  it('다른 프로젝트 대상이면 RPC 없이 NOT_FOUND', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue({ ...customer, as: 'editor' });
    const fake = useFake({ designs: [{ data: null }] });
    expect(await requestReconfirm(input)).toMatchObject({ error: { code: 'NOT_FOUND' } });
    expect(fake.client.rpc).not.toHaveBeenCalled();
  });
  it('소속이 맞으면 RPC 를 부른다', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue({ ...customer, as: 'editor' });
    const fake = useFake({
      designs: [{ data: { id: targetId } }],
      'rpc:request_reconfirm': [{ data: null }],
    });
    expect(await requestReconfirm(input)).toEqual({ ok: true, data: undefined });
    expect(fake.argOf('rpc:request_reconfirm', 'rpc')).toEqual([
      { p_target_type: 'designs', p_target_id: targetId, p_reason: '도면 수정' },
    ]);
  });
});

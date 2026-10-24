// DB-05 후속 — 시공팀 현장 목록은 projects 테이블이 아니라 RPC field_projects() 로만 읽는다
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFake } from '@/features/requests/testing';
import type { AccessContext } from '@/shared/contracts/integration';

vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { listFieldSites } from './field-sites';

const ctx = (participations: AccessContext['participations']): AccessContext => ({
  userId: 'f1',
  displayName: '시공1',
  locale: 'ko',
  memberships: [],
  participations,
  areas: ['field'],
});
const field = (projectId: string) => ({
  projectId,
  companyId: 'c1',
  role: 'field' as const,
  canConfirm: false,
});

function useFake(script: Parameters<typeof createSupabaseFake>[0]) {
  const fake = createSupabaseFake(script);
  vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
  return fake;
}

beforeEach(() => vi.clearAllMocks());

describe('listFieldSites (FW-01, DB-05)', () => {
  it('정상: RPC field_projects 결과를 이름순 현장으로 돌려주고 projects 를 직접 읽지 않는다', async () => {
    const fake = useFake({
      'rpc:field_projects': [
        {
          data: [
            { id: 'p2', company_id: 'c1', name: '서초 B현장', site_address: '서초구' },
            { id: 'p1', company_id: 'c1', name: '강남 A현장', site_address: '강남구' },
          ],
        },
      ],
    });
    const sites = await listFieldSites(ctx([field('p1'), field('p2')]));
    expect(sites).toEqual([
      { projectId: 'p1', name: '강남 A현장', siteAddress: '강남구' },
      { projectId: 'p2', name: '서초 B현장', siteAddress: '서초구' },
    ]);
    expect(fake.client.rpc).toHaveBeenCalledWith('field_projects');
    expect(fake.calls.some((c) => c.table === 'projects')).toBe(false);
  });

  it('권한: AccessContext 의 field 참여가 없는 RPC 행은 거른다 (이중 검증)', async () => {
    useFake({
      'rpc:field_projects': [
        {
          data: [
            { id: 'p1', company_id: 'c1', name: '강남 A현장', site_address: '' },
            { id: 'p9', company_id: 'c2', name: '다른 업체 현장', site_address: '' },
          ],
        },
      ],
    });
    const sites = await listFieldSites(
      ctx([field('p1'), { ...field('p9'), role: 'customer' as const }]),
    );
    expect(sites.map((s) => s.projectId)).toEqual(['p1']);
  });

  it('권한: field 참여가 없으면(만료·회수) DB 를 부르지 않고 빈 목록', async () => {
    const fake = useFake({});
    expect(await listFieldSites(ctx([]))).toEqual([]);
    expect(fake.client.rpc).not.toHaveBeenCalled();
  });

  it('예외: RPC 오류는 "배정 없음" 으로 숨기지 않고 오류 경계로 던진다', async () => {
    useFake({ 'rpc:field_projects': [{ error: { code: '42501', message: 'denied' } }] });
    await expect(listFieldSites(ctx([field('p1')]))).rejects.toThrow('photos.fieldSites:42501');
  });
});

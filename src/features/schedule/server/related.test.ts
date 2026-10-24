// C-05 — 관련 항목 저장 검증은 선택지와 같은 범위(같은 업체·보관 아님·편집 가능한 프로젝트)만 허용
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFake } from '@/features/requests/testing';

vi.mock('@/features/core', () => ({ getAccessContext: vi.fn() }));
vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('@/shared/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  newRef: () => 'ref1234567',
}));
vi.mock('./queries', () => ({ listEditableProjects: vi.fn() }));

import { getAccessContext } from '@/features/core';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { checkRelatedTarget, listRelatedOptions } from './related';
import { listEditableProjects } from './queries';
import { logger } from '@/shared/lib/logger';

const target = (over: Record<string, unknown> = {}) => ({
  id: 'd1',
  company_id: 'c1',
  project_id: 'p1',
  archived_at: null,
  ...over,
});

function useFake(script: Parameters<typeof createSupabaseFake>[0]) {
  const fake = createSupabaseFake(script);
  vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
  return fake;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccessContext).mockResolvedValue({
    userId: 'pm1',
    displayName: 'PM1',
    locale: 'ko',
    memberships: [{ companyId: 'c1', slug: 'studio', name: '스튜디오', role: 'pm' }],
    participations: [{ projectId: 'p1', companyId: 'c1', role: 'pm', canConfirm: false }],
    areas: ['app'],
  });
  vi.mocked(listEditableProjects).mockResolvedValue([{ id: 'p1', name: '강남 A현장' }]);
});

describe('checkRelatedTarget (C-05)', () => {
  it('정상: 같은 업체·보관 아님·편집 가능한 프로젝트의 항목이면 ok', async () => {
    const fake = useFake({ designs: [{ data: target() }] });
    expect(await checkRelatedTarget('designs', 'd1', 'c1')).toBe('ok');
    expect(fake.argOf('designs', 'select')?.[0]).toBe('id, company_id, project_id, archived_at');
    expect(listEditableProjects).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'pm1' }),
      'c1',
    );
  });

  it('예외: 보관된 항목은 archived (선택지에 없는 값)', async () => {
    useFake({ materials: [{ data: target({ archived_at: '2026-10-07T00:00:00Z' }) }] });
    expect(await checkRelatedTarget('materials', 'd1', 'c1')).toBe('archived');
  });

  it('권한: 볼 수는 있어도 편집할 수 없는 프로젝트의 항목은 not_editable', async () => {
    useFake({ photos: [{ data: target({ project_id: 'p-readonly' }) }] });
    expect(await checkRelatedTarget('photos', 'd1', 'c1')).toBe('not_editable');
  });

  it('권한: 다른 업체 항목은 other_company, 볼 수 없으면 not_found (편집 범위 조회 전 중단)', async () => {
    useFake({ requests: [{ data: target({ company_id: 'c2' }) }] });
    expect(await checkRelatedTarget('requests', 'd1', 'c1')).toBe('other_company');
    useFake({ estimate_versions: [{ data: null }] });
    expect(await checkRelatedTarget('estimate_versions', 'd1', 'c1')).toBe('not_found');
    expect(listEditableProjects).not.toHaveBeenCalled();
  });
});

describe('listRelatedOptions (C-08)', () => {
  it('종류별 200개에서 잘리면 경고 로그', async () => {
    const many = Array.from({ length: 200 }, (_, i) => ({
      id: `d${i}`,
      project_id: 'p1',
      title: `시안 ${i}`,
    }));
    useFake({
      designs: [{ data: many }],
      materials: [{ data: [] }],
      estimate_versions: [{ data: [] }],
      requests: [{ data: [] }],
      photos: [{ data: [] }],
    });
    const options = await listRelatedOptions(['p1']);
    expect(options).toHaveLength(200);
    expect(logger.warn).toHaveBeenCalledWith('schedule.related_options.truncated', {
      code: '200',
    });
  });

  it('프로젝트가 없으면 조회하지 않는다', async () => {
    const fake = useFake({});
    expect(await listRelatedOptions([])).toEqual([]);
    expect(fake.calls).toHaveLength(0);
  });
});

// @vitest-environment node
// INT-01: 고객 viewer 면 공개 버전 + 보관되지 않은 견적만. B-07: 고객은 published_at 순, 비공개 버전은 '등록' 문구
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFake } from '@/features/files/testing/supabase-fake';

vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));

import { createServerSupabase } from '@/shared/lib/supabase/server';
import { documentsProvider, summaryProvider } from './summary';

const projectId = '00000000-0000-4000-8000-0000000000b1';
const viewer = (as: 'editor' | 'customer' | 'field') => ({
  projectId,
  companyId: 'c1',
  companySlug: 'studio',
  as,
  canConfirm: false,
});
const v = (o: Record<string, unknown>) => ({
  id: 'v1',
  estimate_id: 'e1',
  version_no: 1,
  version_label: '1차',
  created_at: '2026-10-01T00:00:00Z',
  published_at: '2026-10-02T00:00:00Z',
  is_public: true,
  ...o,
});

function useFake(versions: unknown[], titles: unknown[]) {
  const fake = createSupabaseFake({
    estimate_versions: [{ data: versions }],
    estimates: [{ data: titles }],
  });
  vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
  return fake;
}

beforeEach(() => vi.clearAllMocks());

describe('estimates summaryProvider.recent (INT-01, B-07)', () => {
  it('고객 viewer: 공개 버전만, published_at 순, 보관된 상위 견적은 제외', async () => {
    // e-archived 는 상위 견적 archived_at 필터로 제목이 돌아오지 않는다
    const fake = useFake(
      [v({}), v({ id: 'v2', estimate_id: 'e-archived' })],
      [{ id: 'e1', title: '1차 견적' }],
    );
    const items = await summaryProvider.recent(projectId, viewer('customer'));
    expect(fake.hasOp('estimate_versions', 'eq', ['is_public', true])).toBe(true);
    expect(fake.hasOp('estimate_versions', 'is', ['archived_at', null])).toBe(true);
    expect(fake.opsOf('estimate_versions').find((o) => o.op === 'order')?.args[0]).toBe(
      'published_at',
    );
    expect(fake.hasOp('estimates', 'is', ['archived_at', null])).toBe(true);
    expect(items.map((i) => i.id)).toEqual(['v1']);
    expect(items[0]).toMatchObject({
      screenId: 'CL-19',
      subtitleKey: 'estimates.summary.published',
    });
  });

  it('편집자: 비공개 포함(공개 필터 없음), 비공개 버전은 등록 문구, 표시 시각 순', async () => {
    const fake = useFake(
      [
        v({
          id: 'old-pub',
          created_at: '2026-09-01T00:00:00Z',
          published_at: '2026-10-05T00:00:00Z',
        }),
        v({ id: 'priv', is_public: false, published_at: null, created_at: '2026-10-03T00:00:00Z' }),
      ],
      [{ id: 'e1', title: '1차 견적' }],
    );
    const items = await summaryProvider.recent(projectId, viewer('editor'));
    expect(fake.hasOp('estimate_versions', 'eq', ['is_public', true])).toBe(false);
    expect(items.map((i) => [i.id, i.subtitleKey])).toEqual([
      ['old-pub', 'estimates.summary.published'],
      ['priv', 'estimates.summary.added'],
    ]);
  });

  it('시공팀: 빈 목록', async () => {
    const fake = useFake([], []);
    expect(await summaryProvider.recent(projectId, viewer('field'))).toEqual([]);
    expect(fake.calls).toHaveLength(0);
  });
});

describe('estimates documentsProvider (견적 문서만)', () => {
  it('견적별 최신 공개 버전, 도안은 포함하지 않는다', async () => {
    const fake = useFake(
      [v({ id: 'v3', version_no: 3 }), v({ id: 'v1', version_no: 1 })],
      [{ id: 'e1', title: '1차 견적' }],
    );
    const docs = await documentsProvider.documents(projectId, viewer('customer'));
    expect(fake.hasOp('estimate_versions', 'eq', ['is_public', true])).toBe(true);
    expect(docs.map((d) => d.id)).toEqual(['v3']);
    expect(docs.every((d) => d.kind === 'estimate_versions')).toBe(true);
  });
});

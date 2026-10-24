// @vitest-environment node
// INT-01: 고객 viewer 면 공개·미보관 자재만 (편집자 세션의 PM-03 미리보기 대비)
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFake } from '@/features/files/testing/supabase-fake';

vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));

import { createServerSupabase } from '@/shared/lib/supabase/server';
import { summaryProvider } from './summary';

const projectId = '00000000-0000-4000-8000-0000000000b1';
const viewer = (as: 'editor' | 'customer' | 'field') => ({
  projectId,
  companyId: 'c1',
  companySlug: 'studio',
  as,
  canConfirm: false,
});

function useFake() {
  const fake = createSupabaseFake({
    materials: [
      {
        data: [{ id: 'm1', name: '타일', updated_at: '2026-10-10T00:00:00Z', image_file_id: null }],
      },
    ],
  });
  vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
  return fake;
}

beforeEach(() => vi.clearAllMocks());

describe('materials summaryProvider.recent (INT-01)', () => {
  it('고객 viewer: is_public=true + archived_at null, 고객 경로', async () => {
    const fake = useFake();
    const items = await summaryProvider.recent(projectId, viewer('customer'));
    expect(fake.hasOp('materials', 'eq', ['is_public', true])).toBe(true);
    expect(fake.hasOp('materials', 'is', ['archived_at', null])).toBe(true);
    expect(items[0]).toMatchObject({ screenId: 'CL-15', subtitleKey: 'materials.summary.updated' });
  });

  it('편집자: 공개 필터 없음', async () => {
    const fake = useFake();
    await summaryProvider.recent(projectId, viewer('editor'));
    expect(fake.hasOp('materials', 'eq', ['is_public', true])).toBe(false);
  });

  it('시공팀: 빈 목록', async () => {
    const fake = useFake();
    expect(await summaryProvider.recent(projectId, viewer('field'))).toEqual([]);
    expect(fake.calls).toHaveLength(0);
  });
});

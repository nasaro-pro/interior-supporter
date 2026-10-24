// @vitest-environment node
// INT-01: 고객 viewer(편집자 세션의 PM-03 미리보기 포함)면 provider 가 공개·미보관 필터를 직접 건다
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
const row = { id: 'd1', title: '평면도', current_version: 2, updated_at: '2026-10-10T00:00:00Z' };

function useFake() {
  const fake = createSupabaseFake({
    designs: [{ data: [row] }],
    design_previews: [{ data: [{ design_id: 'd1', file_id: 'f1', created_at: 'x' }] }],
  });
  vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
  return fake;
}

beforeEach(() => vi.clearAllMocks());

describe('designs summaryProvider.recent (INT-01)', () => {
  it('고객 viewer 면 is_public=true·archived_at null 을 직접 건다 (편집자 세션 미리보기 대비)', async () => {
    const fake = useFake();
    const items = await summaryProvider.recent(projectId, viewer('customer'));
    expect(fake.hasOp('designs', 'eq', ['is_public', true])).toBe(true);
    expect(fake.hasOp('designs', 'is', ['archived_at', null])).toBe(true);
    expect(items[0]).toMatchObject({
      href: `/portal/projects/${projectId}/designs/d1`,
      screenId: 'CL-14',
      subtitleKey: 'designs.summary.newVersion',
      thumbnailFileId: 'f1',
    });
  });

  it('편집자는 비공개 포함 (공개 필터 없음), 미보관만', async () => {
    const fake = useFake();
    await summaryProvider.recent(projectId, viewer('editor'));
    expect(fake.hasOp('designs', 'eq', ['is_public', true])).toBe(false);
    expect(fake.hasOp('designs', 'is', ['archived_at', null])).toBe(true);
  });

  it('시공팀은 DB 를 부르지 않고 빈 목록', async () => {
    const fake = useFake();
    expect(await summaryProvider.recent(projectId, viewer('field'))).toEqual([]);
    expect(fake.calls).toHaveLength(0);
  });
});

describe('designs documentsProvider (도안 문서만)', () => {
  it('항상 공개·미보관 도안만', async () => {
    const fake = useFake();
    const docs = await documentsProvider.documents(projectId, viewer('customer'));
    expect(fake.hasOp('designs', 'eq', ['is_public', true])).toBe(true);
    expect(fake.hasOp('designs', 'is', ['archived_at', null])).toBe(true);
    expect(docs.every((d) => d.kind === 'designs')).toBe(true);
  });
});

// @vitest-environment node
// 도안 목록 이미지 — 비교 이미지가 없으면 현재 버전 원본 이미지(JPG·PNG·WebP)로 대신 보여 준다
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFake } from '@/features/files/testing/supabase-fake';

vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));

import { createServerSupabase } from '@/shared/lib/supabase/server';
import { listDesigns } from './queries';

const projectId = '00000000-0000-4000-8000-0000000000b1';
const viewer = {
  projectId,
  companyId: 'c1',
  companySlug: 'studio',
  as: 'editor' as const,
  canConfirm: false,
};
const row = (id: string, current = 2) => ({
  id,
  title: id,
  current_version: current,
  is_public: true,
  confirm_state: 'none',
  updated_at: '2026-10-28T00:00:00Z',
  archived_at: null,
  space: null,
  is_main: false,
  sort_order: 0,
});

beforeEach(() => vi.clearAllMocks());

describe('도안 목록 이미지', () => {
  it('비교 이미지가 있으면 그 이미지, 없으면 현재 버전 원본 이미지, CAD 원본은 없음', async () => {
    const fake = createSupabaseFake({
      designs: [{ data: [row('d1'), row('d2'), row('d3')] }],
      design_previews: [{ data: [{ design_id: 'd1', file_id: 'p1', created_at: 'x' }] }],
      design_versions: [
        {
          data: [
            { design_id: 'd2', version_no: 1, file_id: 'old' },
            { design_id: 'd2', version_no: 2, file_id: 'png' },
            { design_id: 'd3', version_no: 2, file_id: 'dwg' },
          ],
        },
      ],
      files: [
        {
          data: [
            { id: 'png', mime: 'image/png' },
            { id: 'dwg', mime: 'application/acad' },
          ],
        },
      ],
    });
    vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
    const { items } = await listDesigns(projectId, viewer);
    expect(items.map((d) => [d.id, d.previewFileId])).toEqual([
      ['d1', 'p1'],
      ['d2', 'png'],
      ['d3', null],
    ]);
  });

  it('모두 비교 이미지가 있으면 버전·파일을 다시 조회하지 않는다', async () => {
    const fake = createSupabaseFake({
      designs: [{ data: [row('d1')] }],
      design_previews: [{ data: [{ design_id: 'd1', file_id: 'p1', created_at: 'x' }] }],
    });
    vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
    const { items } = await listDesigns(projectId, viewer);
    expect(items[0]!.previewFileId).toBe('p1');
  });

  it('원본 조회가 실패하면 빈 이미지로 삼키지 않고 오류를 낸다', async () => {
    const fake = createSupabaseFake({
      designs: [{ data: [row('d1')] }],
      design_previews: [{ data: [] }],
      design_versions: [{ error: { code: '42501' } }],
    });
    vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
    await expect(listDesigns(projectId, viewer)).rejects.toThrow('designs.list.versions:42501');
  });
});

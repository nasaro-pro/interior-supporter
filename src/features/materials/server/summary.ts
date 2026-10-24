// SummaryProvider — 최근 갱신 자재 (REQ-140). 호출자 RLS + 고객 viewer 면 공개 필터 직접 (INT-01, 편집자 세션 미리보기 대비)
import 'server-only';
import type { ProjectAccess, SummaryItem, SummaryProvider } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { createServerSupabase } from '@/shared/lib/supabase/server';

export function materialHref(viewer: ProjectAccess, id: string) {
  return viewer.as === 'editor'
    ? {
        href: routes.app.material(viewer.companySlug, viewer.projectId, id),
        screenId: 'PM-15' as const,
      }
    : { href: routes.portal.material(viewer.projectId, id), screenId: 'CL-15' as const };
}

/** subtitle: 'summary.updated' — materials 네임스페이스 */
export const materialsSummary: SummaryProvider = {
  async recent(projectId, viewer, limit = 5): Promise<SummaryItem[]> {
    if (viewer.as === 'field') return [];
    const supabase = await createServerSupabase();
    let q = supabase
      .from('materials')
      .select('id, name, updated_at, image_file_id')
      .eq('project_id', projectId)
      .is('archived_at', null);
    if (viewer.as === 'customer') q = q.eq('is_public', true); // INT-01
    const { data, error } = await q.order('updated_at', { ascending: false }).limit(limit);
    // B-10: 실패를 빈 목록으로 삼키지 않는다 — core safe() 가 영역 오류로 보여 준다
    if (error) throw new Error(`materials.summary.recent:${error.code}`);
    return (data ?? []).map((m) => ({
      kind: 'materials',
      id: m.id,
      title: m.name,
      at: m.updated_at,
      subtitleKey: 'materials.summary.updated',
      ...materialHref(viewer, m.id),
      thumbnailFileId: m.image_file_id ?? undefined,
    }));
  },
};

// CR-INT-01(잠정) 연동 이름 규약 — core 개요(features/core/server/overview-queries.ts)가 이 이름으로 import 한다
export const summaryProvider = materialsSummary;

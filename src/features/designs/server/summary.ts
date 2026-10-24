// SummaryProvider·DocumentsProvider (REQ-140, CT05) — integration.ts 3장 시그니처 그대로
// 호출자 권한(RLS)으로 조회한다. 단 INT-01(CR-INT-01): core 의 PM-03 "고객 화면 미리보기"는 편집자 세션으로
// viewer.as='customer' 를 넘기므로 RLS 만 믿으면 비공개가 섞인다 → 고객 viewer 면 공개·미보관 필터를 직접 건다
import 'server-only';
import type {
  DocumentsProvider,
  ProjectAccess,
  SummaryItem,
  SummaryProvider,
} from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { createServerSupabase } from '@/shared/lib/supabase/server';

export function designHref(viewer: ProjectAccess, designId: string) {
  return viewer.as === 'editor'
    ? {
        href: routes.app.design(viewer.companySlug, viewer.projectId, designId),
        screenId: 'PM-14' as const,
      }
    : { href: routes.portal.design(viewer.projectId, designId), screenId: 'CL-14' as const };
}

async function firstPreviewByDesign(designIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!designIds.length) return map;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('design_previews')
    .select('design_id, file_id, created_at')
    .in('design_id', designIds)
    .is('archived_at', null)
    .order('created_at', { ascending: true });
  // B-10: 실패를 삼키지 않는다 — core 의 safe() 가 영역 오류로 보여 준다
  if (error) throw new Error(`designs.summary.previews:${error.code}`);
  for (const p of data ?? []) if (!map.has(p.design_id)) map.set(p.design_id, p.file_id);
  return map;
}

/** 최근 갱신 도안 (최신순). subtitle: 'summary.newVersion' {no} — designs 네임스페이스 */
export const designsSummary: SummaryProvider = {
  async recent(projectId, viewer, limit = 5): Promise<SummaryItem[]> {
    if (viewer.as === 'field') return [];
    const supabase = await createServerSupabase();
    let q = supabase
      .from('designs')
      .select('id, title, current_version, updated_at')
      .eq('project_id', projectId)
      .is('archived_at', null);
    if (viewer.as === 'customer') q = q.eq('is_public', true); // INT-01
    const { data, error } = await q.order('updated_at', { ascending: false }).limit(limit);
    if (error) throw new Error(`designs.summary.recent:${error.code}`);
    const rows = data ?? [];
    const thumbs = await firstPreviewByDesign(rows.map((r) => r.id));
    return rows.map((d) => ({
      kind: 'designs',
      id: d.id,
      title: d.title,
      at: d.updated_at,
      subtitleKey: 'designs.summary.newVersion',
      subtitleValues: { no: d.current_version },
      ...designHref(viewer, d.id),
      thumbnailFileId: thumbs.get(d.id),
    }));
  },
};

/** 고객 홈 문서 영역의 도안 부분: 공개 도안 현재 버전 (documentsProvider 로 제공 — core 개요·고객 홈이 견적 문서와 합친다) */
export async function designDocuments(
  projectId: string,
  viewer: ProjectAccess,
): Promise<SummaryItem[]> {
  if (viewer.as === 'field') return [];
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('designs')
    .select('id, title, current_version, updated_at')
    .eq('project_id', projectId)
    .eq('is_public', true)
    .is('archived_at', null)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`designs.documents:${error.code}`);
  const rows = data ?? [];
  const thumbs = await firstPreviewByDesign(rows.map((r) => r.id));
  return rows.map((d) => ({
    kind: 'designs',
    id: d.id,
    title: d.title,
    at: d.updated_at,
    subtitleKey: 'designs.summary.newVersion',
    subtitleValues: { no: d.current_version },
    ...designHref(viewer, d.id),
    thumbnailFileId: thumbs.get(d.id),
  }));
}

// CR-INT-01(잠정) 연동 이름 규약 — core 개요(features/core/server/overview-queries.ts)가 이 이름으로 import 한다
export const summaryProvider = designsSummary;
export const documentsProvider: DocumentsProvider = { documents: designDocuments };

// SummaryProvider·DocumentsProvider — 견적 버전 (REQ-140). 호출자 RLS + 고객 viewer 면 공개 버전·미보관 견적만 직접 필터
// (INT-01: core PM-03 미리보기는 편집자 세션으로 as='customer' 를 넘긴다)
import 'server-only';
import type {
  DocumentsProvider,
  ProjectAccess,
  SummaryItem,
  SummaryProvider,
} from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { createServerSupabase } from '@/shared/lib/supabase/server';

export function estimateHref(viewer: ProjectAccess, estimateId: string, versionNo: number) {
  return viewer.as === 'editor'
    ? {
        href: routes.app.estimate(viewer.companySlug, viewer.projectId, estimateId, versionNo),
        screenId: 'PM-19' as const,
      }
    : {
        href: routes.portal.estimate(viewer.projectId, estimateId, versionNo),
        screenId: 'CL-19' as const,
      };
}

type VersionRow = {
  id: string;
  estimate_id: string;
  version_no: number;
  version_label: string;
  created_at: string;
  published_at: string | null;
};

async function titles(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('estimates')
    .select('id, title')
    .in('id', ids)
    .is('archived_at', null);
  // B-10: 실패를 삼키지 않는다 (core safe() 가 영역 오류로 표시)
  if (error) throw new Error(`estimates.summary.titles:${error.code}`);
  return new Map((data ?? []).map((e) => [e.id, e.title]));
}

function toItem(
  viewer: ProjectAccess,
  v: VersionRow & { is_public?: boolean },
  title: string,
): SummaryItem {
  // B-07: 비공개 버전(편집자만 봄)에는 '공개' 문구 대신 '등록'
  const published = v.is_public !== false && v.published_at !== null;
  return {
    kind: 'estimate_versions',
    id: v.id,
    title,
    at: v.published_at ?? v.created_at,
    subtitleKey: published ? 'estimates.summary.published' : 'estimates.summary.added',
    subtitleValues: { label: v.version_label },
    ...estimateHref(viewer, v.estimate_id, v.version_no),
  };
}

/** 최근 견적 버전 (고객 = 공개 버전만, RLS). subtitle: 'summary.published' {label} — estimates 네임스페이스 */
export const estimatesSummary: SummaryProvider = {
  async recent(projectId, viewer, limit = 5): Promise<SummaryItem[]> {
    if (viewer.as === 'field') return [];
    const supabase = await createServerSupabase();
    const customer = viewer.as === 'customer';
    let q = supabase
      .from('estimate_versions')
      .select('id, estimate_id, version_no, version_label, created_at, published_at, is_public')
      .eq('project_id', projectId)
      .is('archived_at', null);
    // INT-01: 고객 = 공개 버전만, 표시 시각(published_at) 순 (B-07). 상위 견적 보관 여부는 titles() 가 거른다
    q = customer
      ? q.eq('is_public', true).order('published_at', { ascending: false, nullsFirst: false })
      : q.order('created_at', { ascending: false });
    const { data, error } = await q.limit(limit);
    if (error) throw new Error(`estimates.summary.recent:${error.code}`);
    const rows = data ?? [];
    const t = await titles([...new Set(rows.map((r) => r.estimate_id))]);
    return rows
      .flatMap((v) => {
        const title = t.get(v.estimate_id);
        return title === undefined ? [] : [toItem(viewer, v, title)];
      })
      .sort((a, b) => b.at.localeCompare(a.at));
  },
};

/** 고객 홈 문서 영역 (B 제공): 견적별 최신 공개 버전 (도안 부분은 designs 의 documentsProvider) */
export const documentsProvider: DocumentsProvider = {
  async documents(projectId, viewer): Promise<SummaryItem[]> {
    if (viewer.as === 'field') return [];
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('estimate_versions')
      .select('id, estimate_id, version_no, version_label, created_at, published_at')
      .eq('project_id', projectId)
      .eq('is_public', true)
      .is('archived_at', null)
      .order('version_no', { ascending: false });
    if (error) throw new Error(`estimates.documents:${error.code}`);
    const latest = new Map<string, VersionRow>();
    for (const v of data ?? []) if (!latest.has(v.estimate_id)) latest.set(v.estimate_id, v);
    const t = await titles([...latest.keys()]);
    const estimates = [...latest.values()].flatMap((v) => {
      const title = t.get(v.estimate_id);
      return title === undefined ? [] : [toItem(viewer, v, title)];
    });
    // CR-INT-01(잠정): 도안 문서는 designs 의 documentsProvider 가 따로 제공한다 (core 가 합침 — 중복 방지)
    return estimates.sort((a, b) => b.at.localeCompare(a.at));
  },
};

// CR-INT-01(잠정) 연동 이름 규약 — core 개요(features/core/server/overview-queries.ts)가 이 이름으로 import 한다
export const summaryProvider = estimatesSummary;

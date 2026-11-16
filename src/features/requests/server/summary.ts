// ⑤ SummaryProvider — 최근 요청 (REQ-234, integration.ts 3장). A 의 PM-03 개요·CL-03 고객 홈이 호출.
// 호출자 권한(RLS)으로 조회: 고객은 본인이 쓴 요청만 (POL-018). 시공팀은 요청을 볼 수 없다.
import 'server-only';
import { getAccessContext } from '@/features/core';
import type { SummaryItem, SummaryProvider } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { isUnanswered } from '../lib/memo';
import { targetsOf } from './queries';

export const summaryProvider: SummaryProvider = {
  async recent(projectId, viewer, limit = 5) {
    if (viewer.as === 'field') return [];
    const supabase = await createServerSupabase();
    let query = supabase
      .from('requests')
      .select('id, title, status, updated_at, target_type, target_id')
      .eq('project_id', projectId)
      .is('archived_at', null);
    if (viewer.as === 'customer') {
      const ctx = await getAccessContext();
      query = query.eq('author_id', ctx.userId); // POL-018 이중 검증
    }
    const { data } = await query.order('updated_at', { ascending: false }).limit(limit);
    const rows = data ?? [];
    // D-32 · CU-05: 도안 · 자재에 남긴 메모는 어느 항목인지 함께 ('도안: 거실 아트월 · 처리 중')
    const targets = rows.length ? await targetsOf(supabase, rows) : [];
    return rows.map<SummaryItem>((r, i) => {
      const target = targets[i];
      const values: Record<string, string> = target?.label
        ? { type: target.type, label: target.label, status: r.status }
        : { status: r.status };
      return {
        kind: 'requests',
        id: r.id,
        title: r.title,
        at: r.updated_at,
        subtitleKey: target?.label
          ? 'requests.summary.statusWithTarget'
          : 'requests.summary.status',
        subtitleValues: values,
        screenId: viewer.as === 'editor' ? 'PM-16' : 'CL-16',
        href:
          viewer.as === 'editor'
            ? routes.app.request(viewer.companySlug, projectId, r.id)
            : routes.portal.request(projectId, r.id),
      };
    });
  },
};

/**
 * D-31 · REQ-010 '내 미답변 요청' — 내가 편집할 수 있는 프로젝트(RLS: 담당자는 배정 프로젝트, 업체관리자는 전체)의
 * 보관 · 해결되지 않은 요청 중 고객의 마지막 글 뒤에 답변이 없는 것. 조회 실패는 null (요약 칸을 비운다)
 */
export async function countUnansweredRequests(companyId: string): Promise<number | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('requests')
    .select('id, created_at, request_replies(created_at), request_corrections(created_at)')
    .eq('company_id', companyId)
    .is('archived_at', null)
    .neq('status', 'resolved')
    .limit(1000);
  if (error) return null;
  return (data ?? []).filter(isUnanswered).length;
}

export default summaryProvider;

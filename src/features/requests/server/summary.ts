// ⑤ SummaryProvider — 최근 요청 (REQ-234, integration.ts 3장). A 의 PM-03 개요·CL-03 고객 홈이 호출.
// 호출자 권한(RLS)으로 조회: 고객은 본인이 쓴 요청만 (POL-018). 시공팀은 요청을 볼 수 없다.
import 'server-only';
import { getAccessContext } from '@/features/core';
import type { SummaryItem, SummaryProvider } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { createServerSupabase } from '@/shared/lib/supabase/server';

export const summaryProvider: SummaryProvider = {
  async recent(projectId, viewer, limit = 5) {
    if (viewer.as === 'field') return [];
    const supabase = await createServerSupabase();
    let query = supabase
      .from('requests')
      .select('id, title, status, updated_at')
      .eq('project_id', projectId)
      .is('archived_at', null);
    if (viewer.as === 'customer') {
      const ctx = await getAccessContext();
      query = query.eq('author_id', ctx.userId); // POL-018 이중 검증
    }
    const { data } = await query.order('updated_at', { ascending: false }).limit(limit);
    return (data ?? []).map<SummaryItem>((r) => ({
      kind: 'requests',
      id: r.id,
      title: r.title,
      at: r.updated_at,
      subtitleKey: 'requests.summary.status',
      subtitleValues: { status: r.status },
      screenId: viewer.as === 'editor' ? 'PM-16' : 'CL-16',
      href:
        viewer.as === 'editor'
          ? routes.app.request(viewer.companySlug, projectId, r.id)
          : routes.portal.request(projectId, r.id),
    }));
  },
};

export default summaryProvider;

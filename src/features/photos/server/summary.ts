// ⑤ SummaryProvider — 최근 현장 사진 (REQ-234, integration.ts 3장). 고객은 공개 사진만 (POL-004)
import 'server-only';
import type { SummaryItem, SummaryProvider } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { photoLabel } from '../lib/label';

export const summaryProvider: SummaryProvider = {
  async recent(projectId, viewer, limit = 5) {
    if (viewer.as === 'field') return [];
    const supabase = await createServerSupabase();
    let query = supabase
      .from('photos')
      .select('id, description, captured_on, phase, file_id, thumb_file_id, created_at')
      .eq('project_id', projectId)
      .is('archived_at', null);
    if (viewer.as === 'customer') query = query.eq('is_public', true); // RLS 와 같은 조건 (이중 검증)
    const { data } = await query.order('created_at', { ascending: false }).limit(limit);
    return (data ?? []).map<SummaryItem>((p) => ({
      kind: 'photos',
      id: p.id,
      // 사진에는 제목이 없다 — 설명 → 촬영일 → 등록일(KST) (C-11, 빈 제목 없음)
      title: photoLabel(p),
      at: p.created_at,
      subtitleKey: 'photos.summary.phase',
      subtitleValues: { phase: p.phase },
      screenId: viewer.as === 'editor' ? 'PM-17' : 'CL-17',
      href:
        viewer.as === 'editor'
          ? routes.app.photo(viewer.companySlug, projectId, p.id)
          : routes.portal.photo(projectId, p.id),
      thumbnailFileId: p.thumb_file_id ?? p.file_id,
    }));
  },
};

export default summaryProvider;

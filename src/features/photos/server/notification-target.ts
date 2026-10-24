// ⑥ 알림 대상 해석기 — photos (NOTIFICATION_TARGET_OWNERS.photos = 'C')
// photo_uploaded → PM-17, photo_published → CL-17. 시공팀 영역은 FW-02. 못 보면 null (POL-027)
import 'server-only';
import type { NotificationTargetResolver } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { photoLabel } from '../lib/label';

export const notificationTargetResolver: NotificationTargetResolver = async (
  objectId,
  projectId,
  area,
  companySlug,
) => {
  const supabase = await createServerSupabase();
  let query = supabase
    .from('photos')
    .select('id, description, captured_on, created_at, is_public, archived_at')
    .eq('id', objectId)
    .eq('project_id', projectId);
  // 고객·시공팀에게 보관 사진은 없는 항목 (C-03), 고객은 공개분만 (POL-004 이중 검증)
  if (area !== 'app') query = query.is('archived_at', null);
  if (area === 'portal') query = query.eq('is_public', true);
  const { data } = await query.maybeSingle();
  if (!data) return null;
  if (area !== 'app' && data.archived_at) return null;
  if (area === 'portal' && !data.is_public) return null;
  const title = photoLabel(data); // C-11: 빈 제목 없음
  if (area === 'app') {
    return { title, href: routes.app.photo(companySlug, projectId, data.id), screenId: 'PM-17' };
  }
  if (area === 'portal') {
    return { title, href: routes.portal.photo(projectId, data.id), screenId: 'CL-17' };
  }
  return { title, href: routes.field.photo(data.id, projectId), screenId: 'FW-02' };
};

export default notificationTargetResolver;

// CR-INT-01(잠정) 연동 이름 규약 — core 등록부(features/core/notifications/targets.ts)가 이 이름으로 import 한다
export const notificationTarget = notificationTargetResolver;

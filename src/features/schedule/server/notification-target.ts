// ⑥ 알림 대상 해석기 — schedule_events (NOTIFICATION_TARGET_OWNERS.schedule_events = 'C')
// schedule_changed → CL-18. 시공팀은 일정을 볼 수 없다. 못 보면 null (POL-027)
import 'server-only';
import type { NotificationTargetResolver } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { createServerSupabase } from '@/shared/lib/supabase/server';

export const notificationTargetResolver: NotificationTargetResolver = async (
  objectId,
  projectId,
  area,
  companySlug,
) => {
  if (area === 'field') return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('schedule_events')
    .select('id, title, is_public')
    .eq('id', objectId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (!data) return null;
  if (area === 'portal' && !data.is_public) return null; // D13 이중 검증
  return area === 'app'
    ? {
        title: data.title,
        href: routes.app.scheduleEvent(companySlug, projectId, data.id),
        screenId: 'PM-18',
      }
    : {
        title: data.title,
        href: routes.portal.scheduleEvent(projectId, data.id),
        screenId: 'CL-18',
      };
};

export default notificationTargetResolver;

// CR-INT-01(잠정) 연동 이름 규약 — core 등록부(features/core/notifications/targets.ts)가 이 이름으로 import 한다
export const notificationTarget = notificationTargetResolver;

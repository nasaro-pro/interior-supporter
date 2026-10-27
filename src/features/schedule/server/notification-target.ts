// ⑥ 알림 대상 해석기 — schedule_events (NOTIFICATION_TARGET_OWNERS.schedule_events = 'C')
// schedule_changed → PM-18 / CL-18 / FW-04. 시공팀은 담당자가 일정 탭을 켠 현장만 (F11). 못 보면 null (POL-027)
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
  const supabase = await createServerSupabase();
  if (area === 'field') {
    // 시공팀은 schedule_events 를 직접 못 읽는다 → 탭 판정까지 하는 field_schedule RPC
    const { data } = await supabase.rpc('field_schedule', { p_project: projectId });
    const event = data?.find((e) => e.id === objectId);
    return event
      ? {
          title: event.title,
          href: routes.field.site(projectId, 'schedule'),
          screenId: 'FW-04',
        }
      : null;
  }
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

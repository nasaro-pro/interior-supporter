// 알림 대상 해석기 — object_type 'designs' (REQ-140, integration.ts 4장)
// 제목은 현재 권한으로 다시 조회한다 (A-T07: 유출 방지). 볼 수 없으면 null
import 'server-only';
import type { NotificationTargetResolver } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { createServerSupabase } from '@/shared/lib/supabase/server';

export const resolveDesignTarget: NotificationTargetResolver = async (
  objectId,
  projectId,
  area,
  companySlug,
) => {
  if (area === 'field') return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('designs')
    .select('id, title')
    .eq('id', objectId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (!data) return null;
  return area === 'app'
    ? {
        title: data.title,
        href: routes.app.design(companySlug, projectId, data.id),
        screenId: 'PM-14',
      }
    : { title: data.title, href: routes.portal.design(projectId, data.id), screenId: 'CL-14' };
};

// CR-INT-01(잠정) 연동 이름 규약 — core 등록부(features/core/notifications/targets.ts)가 이 이름으로 import 한다
export const notificationTarget = resolveDesignTarget;

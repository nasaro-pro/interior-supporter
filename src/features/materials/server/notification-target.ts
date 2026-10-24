// 알림 대상 해석기 — object_type 'materials' (integration.ts 4장). 현재 권한으로 다시 조회, 볼 수 없으면 null
import 'server-only';
import type { NotificationTargetResolver } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { createServerSupabase } from '@/shared/lib/supabase/server';

export const resolveMaterialTarget: NotificationTargetResolver = async (
  objectId,
  projectId,
  area,
  companySlug,
) => {
  if (area === 'field') return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('materials')
    .select('id, name')
    .eq('id', objectId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (!data) return null;
  return area === 'app'
    ? {
        title: data.name,
        href: routes.app.material(companySlug, projectId, data.id),
        screenId: 'PM-15',
      }
    : { title: data.name, href: routes.portal.material(projectId, data.id), screenId: 'CL-15' };
};

// CR-INT-01(잠정) 연동 이름 규약 — core 등록부(features/core/notifications/targets.ts)가 이 이름으로 import 한다
export const notificationTarget = resolveMaterialTarget;

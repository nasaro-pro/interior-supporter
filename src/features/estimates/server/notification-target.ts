// 알림 대상 해석기 — object_type 'estimate_versions' (integration.ts 4장). 현재 권한으로 재조회, 볼 수 없으면 null
import 'server-only';
import type { NotificationTargetResolver } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { createServerSupabase } from '@/shared/lib/supabase/server';

export const resolveEstimateVersionTarget: NotificationTargetResolver = async (
  objectId,
  projectId,
  area,
  companySlug,
) => {
  if (area === 'field') return null;
  const supabase = await createServerSupabase();
  const { data: v } = await supabase
    .from('estimate_versions')
    .select('id, estimate_id, version_no, version_label')
    .eq('id', objectId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (!v) return null;
  const { data: e } = await supabase
    .from('estimates')
    .select('id, title')
    .eq('id', v.estimate_id)
    .maybeSingle();
  if (!e) return null;
  const title = `${e.title} · ${v.version_label}`;
  return area === 'app'
    ? {
        title,
        href: routes.app.estimate(companySlug, projectId, e.id, v.version_no),
        screenId: 'PM-19',
      }
    : { title, href: routes.portal.estimate(projectId, e.id, v.version_no), screenId: 'CL-19' };
};

// CR-INT-01(잠정) 연동 이름 규약 — core 등록부(features/core/notifications/targets.ts)가 이 이름으로 import 한다
export const notificationTarget = resolveEstimateVersionTarget;

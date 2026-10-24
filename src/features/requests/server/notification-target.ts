// ⑥ 알림 대상 해석기 — requests (integration.ts 4장, NOTIFICATION_TARGET_OWNERS.requests = 'C')
// 제목은 현재 권한으로 다시 조회한다. 못 보면 null → "더 이상 볼 수 없는 항목" (POL-027, A-T07)
import 'server-only';
import { getAccessContext } from '@/features/core';
import type { NotificationTargetResolver } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { createServerSupabase } from '@/shared/lib/supabase/server';

export const notificationTargetResolver: NotificationTargetResolver = async (
  objectId,
  projectId,
  area,
  companySlug,
) => {
  if (area === 'field') return null; // 시공팀은 요청을 볼 수 없다
  const supabase = await createServerSupabase();
  let query = supabase
    .from('requests')
    .select('id, title, author_id')
    .eq('id', objectId)
    .eq('project_id', projectId);
  // POL-018 이중 검증 (C-01): 고객 영역은 본인이 쓴 요청만 — RLS 와 같은 조건
  let userId: string | null = null;
  if (area === 'portal') {
    userId = (await getAccessContext()).userId;
    query = query.eq('author_id', userId);
  }
  const { data } = await query.maybeSingle();
  if (!data) return null;
  if (userId !== null && data.author_id !== userId) return null;
  // TR-09: 역할별 정규 상세 PM-16 / CL-16
  return area === 'app'
    ? {
        title: data.title,
        href: routes.app.request(companySlug, projectId, data.id),
        screenId: 'PM-16',
      }
    : { title: data.title, href: routes.portal.request(projectId, data.id), screenId: 'CL-16' };
};

export default notificationTargetResolver;

// CR-INT-01(잠정) 연동 이름 규약 — core 등록부(features/core/notifications/targets.ts)가 이 이름으로 import 한다
export const notificationTarget = notificationTargetResolver;

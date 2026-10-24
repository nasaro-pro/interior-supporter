// src/features/core/notifications/participant-target.ts (A) — assignment_changed 알림 → 역할 영역 첫 화면 (03 문서 6.2)
// NOTIFICATION_TARGET_OWNERS.project_participants = 'A'
import 'server-only';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { routes } from '@/shared/contracts/routes';
import type { NotificationTargetResolver } from '@/shared/contracts/integration';
import { findProjectAccess, loadProjectBrief } from '../server/access';

export const participantTarget: NotificationTargetResolver = async (objectId, projectId, area) => {
  const supabase = await createServerSupabase();
  // 본인 참여 행만 보인다 (RLS participants_select: user_id = auth.uid() 또는 편집자)
  const { data: row } = await supabase
    .from('project_participants')
    .select('role, project_id')
    .eq('id', objectId)
    .maybeSingle();
  if (!row || row.project_id !== projectId) return null;

  // 현재 권한으로 다시 판정 — 회수·만료·비공개면 null ("더 이상 볼 수 없는 항목")
  const as = row.role === 'pm' ? 'editor' : row.role;
  const access = await findProjectAccess(projectId, [as]);
  if (!access) return null;
  // DB-05: 시공팀은 projects 를 직접 못 읽는다 → project_brief RPC (findProjectAccess 와 같은 요청 캐시)
  const project = await loadProjectBrief(projectId);
  if (!project) return null;

  if (access.as === 'editor' && area === 'app')
    return {
      title: project.name,
      href: routes.app.project(access.companySlug, projectId),
      screenId: 'PM-03',
    };
  if (access.as === 'customer')
    return { title: project.name, href: routes.portal.project(projectId), screenId: 'CL-03' };
  if (access.as === 'field')
    return { title: project.name, href: routes.field.photos(projectId), screenId: 'FW-01' };
  return null;
};

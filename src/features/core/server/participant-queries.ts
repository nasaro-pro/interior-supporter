// src/features/core/server/participant-queries.ts (A · TASK-007·015) — 참여자·초대·구성원 조회
import 'server-only';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { todayKst } from '@/shared/lib/dates';
import type { MemberRole, ParticipantRole } from '@/shared/contracts/domain';
import type { InviteItem, MemberItem, ParticipantItem } from '../types';

export async function displayNames(userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return new Map();
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('profiles').select('id, display_name').in('id', ids);
  return new Map((data ?? []).map((p) => [p.id, p.display_name]));
}

function participantState(
  p: { revoked_at: string | null; valid_from: string | null; valid_until: string | null },
  today: string,
): ParticipantItem['state'] {
  if (p.revoked_at) return 'revoked';
  if (p.valid_from && today < p.valid_from) return 'pending';
  if (p.valid_until && today > p.valid_until) return 'expired';
  return 'active';
}

/** PM-10 참여자 목록 (RLS: 편집자 = 프로젝트 전체) */
export async function listParticipants(projectId: string): Promise<ParticipantItem[] | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('project_participants')
    .select(
      'id, user_id, role, can_confirm, valid_from, valid_until, revoked_at, version, created_at',
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) return null;
  const names = await displayNames(data.map((p) => p.user_id));
  const today = todayKst();
  return data.map((p) => ({
    id: p.id,
    userId: p.user_id,
    displayName: names.get(p.user_id) ?? '—',
    role: p.role,
    canConfirm: p.can_confirm,
    validFrom: p.valid_from,
    validUntil: p.valid_until,
    revokedAt: p.revoked_at,
    version: p.version,
    state: participantState(p, today),
  }));
}

/** 대기 중 초대 (프로젝트 또는 업체 구성원 초대) */
export async function listPendingInvites(
  scope: { projectId: string } | { companyId: string },
): Promise<InviteItem[] | null> {
  const supabase = await createServerSupabase();
  let q = supabase
    .from('invitations')
    .select(
      'id, email, member_role, participant_role, can_confirm, valid_from, valid_until, expires_at',
    )
    .is('accepted_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString());
  q =
    'projectId' in scope
      ? q.eq('project_id', scope.projectId)
      : q.eq('company_id', scope.companyId).is('project_id', null);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) return null;
  return data.map((i) => ({
    id: i.id,
    email: i.email,
    role: (i.participant_role ?? i.member_role) as ParticipantRole | MemberRole,
    canConfirm: i.can_confirm,
    validFrom: i.valid_from,
    validUntil: i.valid_until,
    expiresAt: i.expires_at,
  }));
}

/** 업체 구성원 (PM-62, PM 배정 후보) */
export async function listMembers(companyId: string): Promise<MemberItem[] | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('company_members')
    .select('id, user_id, role, created_at, version')
    .eq('company_id', companyId)
    .is('removed_at', null)
    .order('created_at', { ascending: true });
  if (error) return null;
  const names = await displayNames(data.map((m) => m.user_id));
  return data.map((m) => ({
    id: m.id,
    userId: m.user_id,
    displayName: names.get(m.user_id) ?? '—',
    role: m.role,
    createdAt: m.created_at,
    version: m.version,
  }));
}

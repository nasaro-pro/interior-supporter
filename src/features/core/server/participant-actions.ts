'use server';
// src/features/core/server/participant-actions.ts (A · TASK-007·015) — 참여자 배정·초대 링크·기간·회수·확정권 (REQ-003·018·051)
// 초대 링크: 토큰 32바이트 → DB 에는 SHA-256 만, 화면에 한 번만 표시 (POL-008). 토큰 원문은 저장·로그 금지
import { createHash, randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { fail, ok, type ActionResult } from '@/shared/contracts/errors';
import { routes } from '@/shared/contracts/routes';
import { dbFail, formToObject, parseInput } from '@/shared/lib/action';
import {
  assignPmSchema,
  companyAccessRevokeSchema,
  inviteRevokeSchema,
  memberInviteSchema,
  memberRemoveSchema,
  memberRoleSchema,
  participantRevokeSchema,
  participantUpdateSchema,
  projectInviteSchema,
} from '../schema';
import { findProjectAccess, loadAccessContext } from './access';

const appOrigin = () => process.env.APP_ORIGIN ?? 'http://localhost:3000';

function newInviteToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: createHash('sha256').update(token).digest('hex') };
}

function revalidateSettings(slug: string, projectId: string) {
  revalidatePath(routes.app.project(slug, projectId, 'settings'));
}

export type InviteLink = { link: string; expiresAt: string };

// ── REQ-003 고객·시공팀 초대 링크 (편집자) ─────────────────────────────
export async function createProjectInvite(
  _prev: ActionResult<InviteLink> | null,
  form: FormData,
): Promise<ActionResult<InviteLink>> {
  const parsed = parseInput(projectInviteSchema, formToObject(form));
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const access = await findProjectAccess(v.projectId, ['editor']);
  const ctx = await loadAccessContext();
  if (!access || !ctx) return fail('NOT_FOUND');

  const { token, hash } = newInviteToken();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('invitations')
    .insert({
      company_id: access.companyId,
      project_id: v.projectId,
      email: v.email,
      participant_role: v.role,
      can_confirm: v.role === 'customer' && v.canConfirm,
      valid_from: v.validFrom,
      valid_until: v.validUntil,
      token_hash: hash,
      created_by: ctx.userId,
    })
    .select('expires_at')
    .single();
  if (error) return dbFail('invite.project.create_failed', error, { projectId: v.projectId });
  revalidateSettings(access.companySlug, v.projectId);
  return ok({ link: `${appOrigin()}${routes.invite(token)}`, expiresAt: data.expires_at });
}

// ── REQ-051 업체 구성원 초대 (PM = owner/manager, manager = owner — RLS 가 판정) ─────
export async function createMemberInvite(
  _prev: ActionResult<InviteLink> | null,
  form: FormData,
): Promise<ActionResult<InviteLink>> {
  const parsed = parseInput(memberInviteSchema, formToObject(form));
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const ctx = await loadAccessContext();
  const member = ctx?.memberships.find((m) => m.companyId === v.companyId);
  if (!ctx || !member) return fail('NOT_FOUND');
  if (member.role === 'pm' || (v.role === 'manager' && member.role !== 'owner'))
    return fail('FORBIDDEN');

  const { token, hash } = newInviteToken();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('invitations')
    .insert({
      company_id: v.companyId,
      project_id: null,
      email: v.email,
      member_role: v.role,
      token_hash: hash,
      created_by: ctx.userId,
    })
    .select('expires_at')
    .single();
  if (error) return dbFail('invite.member.create_failed', error, { companyId: v.companyId });
  revalidatePath(routes.app.settings(member.slug, 'members'));
  return ok({ link: `${appOrigin()}${routes.invite(token)}`, expiresAt: data.expires_at });
}

/**
 * 대기 중 초대 폐기 — A-04: RLS(invitations_update) 와 별도로 앱에서 먼저 권한을 본다 (P-02 이중 검증)
 * 프로젝트 초대 = 그 프로젝트 편집자, 업체 구성원 초대 = 그 업체 owner/manager. 아니면 존재 숨김 NOT_FOUND.
 */
export async function revokeInvite(raw: unknown): Promise<ActionResult<null>> {
  const parsed = parseInput(inviteRevokeSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const ctx = await loadAccessContext();
  if (!ctx) return fail('NOT_FOUND');
  const supabase = await createServerSupabase();
  const { data: inv, error: readError } = await supabase
    .from('invitations')
    .select('id, company_id, project_id')
    .eq('id', v.inviteId)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .maybeSingle();
  if (readError) return dbFail('invite.revoke.read_failed', readError, { objectId: v.inviteId });
  if (!inv) return fail('NOT_FOUND');
  // 화면이 넘긴 projectId 와 실제 초대 범위가 다르면 거부 (다른 화면에서 온 요청)
  if ((inv.project_id ?? null) !== (v.projectId ?? null)) return fail('NOT_FOUND');

  let slug: string | undefined;
  if (inv.project_id) {
    const access = await findProjectAccess(inv.project_id, ['editor']);
    if (!access || access.companyId !== inv.company_id) return fail('NOT_FOUND');
    slug = access.companySlug;
  } else {
    const m = ctx.memberships.find((x) => x.companyId === inv.company_id);
    if (!m || (m.role !== 'owner' && m.role !== 'manager')) return fail('NOT_FOUND');
    slug = m.slug;
  }

  const { data, error } = await supabase
    .from('invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', inv.id)
    .eq('company_id', inv.company_id)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();
  if (error) return dbFail('invite.revoke.failed', error, { objectId: v.inviteId });
  if (!data) return fail('NOT_FOUND');
  if (inv.project_id) revalidateSettings(slug, inv.project_id);
  else revalidatePath(routes.app.settings(slug, 'members'));
  return ok(null);
}

// ── REQ-018 PM 배정 (업체 구성원만, DB pm_must_be_member) ─────────────────
export async function assignPm(raw: unknown): Promise<ActionResult<null>> {
  const parsed = parseInput(assignPmSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const access = await findProjectAccess(v.projectId, ['editor']);
  const ctx = await loadAccessContext();
  if (!access || !ctx) return fail('NOT_FOUND');

  const supabase = await createServerSupabase();
  const { error } = await supabase.from('project_participants').insert({
    company_id: access.companyId,
    project_id: v.projectId,
    user_id: v.userId,
    role: 'pm',
    invited_by: ctx.userId,
  });
  if (error?.code === '23505') {
    // 이미 배정(또는 회수된 배정) → 회수를 풀어 다시 유효하게.
    // A-10: 만료된 기간이 남아 있으면 "성공"인데 접근 불가 → 기간도 비운다(PM 은 상시).
    //       영향 행 0(RLS 거부·행 없음)이면 성공으로 보이지 않게 NOT_FOUND.
    const { data: row, error: e2 } = await supabase
      .from('project_participants')
      .update({ revoked_at: null, valid_from: null, valid_until: null })
      .eq('project_id', v.projectId)
      .eq('user_id', v.userId)
      .eq('role', 'pm')
      .select('id')
      .maybeSingle();
    if (e2) return dbFail('participant.pm.reassign_failed', e2, { projectId: v.projectId });
    if (!row) return fail('NOT_FOUND');
  } else if (error) {
    return dbFail('participant.pm.assign_failed', error, { projectId: v.projectId });
  }
  revalidateSettings(access.companySlug, v.projectId);
  return ok(null);
}

/** 기간·확정권 수정 (확정권은 고객만 — DB CHECK) */
export async function updateParticipant(
  _prev: ActionResult<{ version: number }> | null,
  form: FormData,
): Promise<ActionResult<{ version: number }>> {
  const parsed = parseInput(participantUpdateSchema, formToObject(form));
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const access = await findProjectAccess(v.projectId, ['editor']);
  if (!access) return fail('NOT_FOUND');
  const supabase = await createServerSupabase();
  const { data: row } = await supabase
    .from('project_participants')
    .select('role')
    .eq('id', v.participantId)
    .eq('project_id', v.projectId)
    .maybeSingle();
  if (!row) return fail('NOT_FOUND');
  const { data, error } = await supabase
    .from('project_participants')
    .update({
      valid_from: v.validFrom,
      valid_until: v.validUntil,
      can_confirm: row.role === 'customer' ? v.canConfirm : false,
    })
    .eq('id', v.participantId)
    .eq('project_id', v.projectId)
    .eq('version', v.baseVersion)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('participant.update.failed', error, { projectId: v.projectId });
  if (!data) return fail('VERSION_CONFLICT');
  revalidateSettings(access.companySlug, v.projectId);
  return ok({ version: data.version });
}

/** 회수 (즉시 차단 — 다음 요청부터 RLS 가 막는다) */
export async function revokeParticipant(raw: unknown): Promise<ActionResult<null>> {
  const parsed = parseInput(participantRevokeSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const access = await findProjectAccess(v.projectId, ['editor']);
  if (!access) return fail('NOT_FOUND');
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('project_participants')
    .update({ revoked_at: new Date().toISOString(), can_confirm: false })
    .eq('id', v.participantId)
    .eq('project_id', v.projectId)
    .eq('version', v.baseVersion)
    .select('id')
    .maybeSingle();
  if (error) return dbFail('participant.revoke.failed', error, { projectId: v.projectId });
  if (!data) return fail('VERSION_CONFLICT');
  revalidateSettings(access.companySlug, v.projectId);
  return ok(null);
}

// ── REQ-051 구성원 역할 변경·제거 (owner 만 — RLS, 소유자 행 불변 — 트리거) ───────
export async function changeMemberRole(raw: unknown): Promise<ActionResult<null>> {
  const parsed = parseInput(memberRoleSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const ctx = await loadAccessContext();
  const me = ctx?.memberships.find((m) => m.companyId === v.companyId);
  if (!me) return fail('NOT_FOUND');
  if (me.role !== 'owner') return fail('FORBIDDEN');
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('company_members')
    .update({ role: v.role })
    .eq('id', v.memberId)
    .eq('company_id', v.companyId)
    .eq('version', v.baseVersion)
    .select('id')
    .maybeSingle();
  if (error) return dbFail('member.role.failed', error, { companyId: v.companyId });
  if (!data) return fail('VERSION_CONFLICT');
  revalidatePath(routes.app.settings(me.slug, 'members'));
  return ok(null);
}

export async function removeMember(raw: unknown): Promise<ActionResult<null>> {
  const parsed = parseInput(memberRemoveSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const ctx = await loadAccessContext();
  const me = ctx?.memberships.find((m) => m.companyId === v.companyId);
  if (!me) return fail('NOT_FOUND');
  if (me.role !== 'owner') return fail('FORBIDDEN');
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('company_members')
    .update({ removed_at: new Date().toISOString() })
    .eq('id', v.memberId)
    .eq('company_id', v.companyId)
    .eq('version', v.baseVersion)
    .select('id')
    .maybeSingle();
  if (error) return dbFail('member.remove.failed', error, { companyId: v.companyId });
  if (!data) return fail('VERSION_CONFLICT');
  revalidatePath(routes.app.settings(me.slug, 'members'));
  return ok(null);
}

/**
 * D-17: 이 업체에서의 고객·시공팀 접근 일괄 회수. 계정 자체는 그대로 둔다
 * (다른 업체 프로젝트에도 참여할 수 있으므로 계정 정지 대신 이 업체 배정만 회수).
 * 디자이너 세션으로 update — RLS(participants_update = 편집 가능한 프로젝트)가 범위를 다시 제한한다.
 */
export async function revokeCompanyAccess(
  raw: unknown,
): Promise<ActionResult<{ revoked: number }>> {
  const parsed = parseInput(companyAccessRevokeSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const ctx = await loadAccessContext();
  const member = ctx?.memberships.find((m) => m.companyId === v.companyId);
  if (!ctx || !member) return fail('NOT_FOUND');
  if (v.userId === ctx.userId) return fail('FORBIDDEN');
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('project_participants')
    .update({ revoked_at: new Date().toISOString() })
    .eq('company_id', v.companyId)
    .eq('user_id', v.userId)
    .in('role', ['customer', 'field'])
    .is('revoked_at', null)
    .select('project_id');
  if (error) return dbFail('participant.company_revoke.failed', error, { companyId: v.companyId });
  if (!data.length) return fail('NOT_FOUND');
  revalidatePath(routes.app.settings(member.slug, 'members'));
  for (const p of data) revalidateSettings(member.slug, p.project_id);
  return ok({ revoked: data.length });
}

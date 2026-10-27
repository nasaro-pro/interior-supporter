'use server';
// src/features/core/server/create-permission-actions.ts (A · D-36 · CA-07) — 프로젝트 생성 권한 요청 · 승인 · 켜기/끄기
// 판정은 RPC(SECURITY DEFINER) 가 한다: 요청 = 담당자(pm)만, 승인·켜기 = 업체관리자(owner·manager)만
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { fail, ok, type ActionResult } from '@/shared/contracts/errors';
import { routes } from '@/shared/contracts/routes';
import { dbFail, parseInput } from '@/shared/lib/action';
import {
  createPermissionDecideSchema,
  createPermissionRequestSchema,
  createPermissionSetSchema,
} from '../schema';
import { loadAccessContext } from './access';

async function memberOf(companyId: string) {
  const ctx = await loadAccessContext();
  const member = ctx?.memberships.find((m) => m.companyId === companyId);
  return ctx && member ? { ctx, member } : null;
}

function rpcFail(event: string, error: { code?: string; message?: string }, companyId: string) {
  if (error.message === 'forbidden') return fail('FORBIDDEN');
  if (error.message === 'already_allowed') return fail('CONFLICT');
  if (error.message === 'invalid_target') return fail('VALIDATION_FAILED');
  return dbFail(event, error, { companyId });
}

/** 담당자: 생성 권한 요청 (대기 중이면 같은 요청) */
export async function requestProjectCreatePermission(
  raw: unknown,
): Promise<ActionResult<{ requestId: string }>> {
  const parsed = parseInput(createPermissionRequestSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const found = await memberOf(v.companyId);
  if (!found) return fail('NOT_FOUND');
  if (found.member.role !== 'pm') return fail('FORBIDDEN');
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('request_project_create', {
    p_company: v.companyId,
    p_note: v.note,
  });
  if (error) return rpcFail('project_create_permission.request_failed', error, v.companyId);
  revalidatePath(routes.app.projects(found.member.slug));
  revalidatePath(routes.app.settings(found.member.slug, 'members'));
  return ok({ requestId: data });
}

/** 업체관리자: 요청 승인 · 거절 */
export async function decideProjectCreatePermission(raw: unknown): Promise<ActionResult<null>> {
  const parsed = parseInput(createPermissionDecideSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const found = await memberOf(v.companyId);
  if (!found) return fail('NOT_FOUND');
  if (found.member.role === 'pm') return fail('FORBIDDEN');
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('decide_project_create_request', {
    p_request: v.requestId,
    p_approve: v.approve,
  });
  if (error) return rpcFail('project_create_permission.decide_failed', error, v.companyId);
  revalidatePath(routes.app.settings(found.member.slug, 'members'));
  return ok(null);
}

/** 업체관리자: 담당자 권한 켜기 · 끄기 (대기 요청도 함께 처리) */
export async function setProjectCreatePermission(raw: unknown): Promise<ActionResult<null>> {
  const parsed = parseInput(createPermissionSetSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const found = await memberOf(v.companyId);
  if (!found) return fail('NOT_FOUND');
  if (found.member.role === 'pm') return fail('FORBIDDEN');
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('set_project_create_permission', {
    p_member: v.memberId,
    p_allowed: v.allowed,
  });
  if (error) return rpcFail('project_create_permission.set_failed', error, v.companyId);
  revalidatePath(routes.app.settings(found.member.slug, 'members'));
  return ok(null);
}

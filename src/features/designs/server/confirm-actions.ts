'use server';
// 확정 실행 (REQ-120, CT06) · 재확인 요청 (REQ-121) — RPC 만 (confirm_target, request_reconfirm)
// 확정권 판정의 원본은 DB private.can_confirm_on. 앱 검사는 조기 차단용 (B-T07)
import { revalidatePath } from 'next/cache';
import { requireProjectAccess } from '@/features/core';
import { fail, ok, type ActionResult } from '@/shared/contracts/errors';
import type { ProjectAccess } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import {
  confirmTargetSchema,
  reconfirmRequestSchema,
  type ConfirmTargetType,
} from '@/features/designs/schema';
import { dbFail, invalid } from '@/features/designs/server/result';

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

/**
 * B-13: 대상이 경로의 프로젝트 소속인지 RPC 전에 확인한다 (RLS 로 볼 수 있는 행만).
 * 다른 프로젝트 id 로 부르면 canConfirm·revalidate 가 엉뚱한 프로젝트 기준이 되므로 NOT_FOUND 로 끊는다.
 */
async function targetInProject(
  supabase: Supabase,
  type: ConfirmTargetType,
  targetId: string,
  projectId: string,
): Promise<ActionResult<true>> {
  const { data, error } = await supabase
    .from(type)
    .select('id')
    .eq('id', targetId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (error)
    return dbFail('confirm.target_lookup_failed', error, { projectId, objectId: targetId });
  if (!data) return fail('NOT_FOUND');
  return ok(true);
}

function revalidateTarget(access: ProjectAccess, type: ConfirmTargetType, id: string) {
  const { companySlug: c, projectId: p } = access;
  if (type === 'designs') {
    revalidatePath(routes.app.project(c, p, 'designs'));
    revalidatePath(routes.app.design(c, p, id));
    revalidatePath(routes.portal.project(p, 'designs'));
    revalidatePath(routes.portal.design(p, id));
  } else {
    revalidatePath(routes.app.project(c, p, 'materials'));
    revalidatePath(routes.app.material(c, p, id));
    revalidatePath(routes.portal.project(p, 'materials'));
    revalidatePath(routes.portal.material(p, id));
  }
}

/** 고객 확정 — 중복·오래된 화면(STALE_REVISION)·권한 없음은 서버가 거절 */
export async function confirmTarget(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = confirmTargetSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { projectId, targetType, targetId, revision } = parsed.data;
  const access = await requireProjectAccess(projectId, ['customer']);
  if (!access.canConfirm) return fail('FORBIDDEN');
  const supabase = await createServerSupabase();
  const owned = await targetInProject(supabase, targetType, targetId, projectId);
  if (!owned.ok) return owned;
  const { data, error } = await supabase.rpc('confirm_target', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_revision: revision,
  });
  if (error) return dbFail('confirm.failed', error, { projectId, objectId: targetId });
  revalidateTarget(access, targetType, targetId);
  return ok({ id: data });
}

/** PM 재확인 요청 (사유 필수). PM 은 확정 상태를 직접 바꾸지 못한다 (POL-013) */
export async function requestReconfirm(raw: unknown): Promise<ActionResult> {
  const parsed = reconfirmRequestSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { projectId, targetType, targetId, reason } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  const supabase = await createServerSupabase();
  const owned = await targetInProject(supabase, targetType, targetId, projectId);
  if (!owned.ok) return owned;
  const { error } = await supabase.rpc('request_reconfirm', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: reason,
  });
  if (error) return dbFail('reconfirm.failed', error, { projectId, objectId: targetId });
  revalidateTarget(access, targetType, targetId);
  return ok(undefined);
}

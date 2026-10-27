'use server';
// src/features/admin/server/actions.ts — 사이트 관리 처리 (A4~A7, A10)
// 순서: 입력 검증 → 관리자(또는 본인) 확인 → DB RPC(권한 재검사·기록) → Auth·Storage 후속 처리 → 화면 갱신
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { routes } from '@/shared/contracts/routes';
import { fail, ok, type ActionResult } from '@/shared/contracts/errors';
import { dbFail, parseInput } from '@/shared/lib/action';
import { logger, newRef } from '@/shared/lib/logger';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { getSessionUserId } from '@/features/core/server/access';
import { gbToBytes, mbToBytes } from '../lib/bytes';
import { explainAdminDbError } from '../lib/db-errors';
import { groupPathsByBucket } from '../lib/mappers';
import {
  changeOwnerSchema,
  companyQuotaSchema,
  purgeFilesSchema,
  siteSettingsSchema,
  suspendSchema,
  userTargetSchema,
} from '../schema';
import {
  anonymizeAuthUser,
  createRecoveryToken,
  removeStorageObjects,
  setLoginBlocked,
} from './auth-admin';
import { isPlatformAdmin } from './guard';
import { listCleanupCandidates } from './queries';

const appOrigin = () => process.env.APP_ORIGIN ?? 'http://localhost:3000';

/** 관리자 RPC 오류 → 결과. 알려진 사유는 화면 문구 키를 fieldErrors._form 에 싣는다 */
function rpcFail(event: string, error: { code?: string; message?: string }, fields = {}) {
  const known = explainAdminDbError(error.message);
  if (known) {
    return fail(
      known.code,
      known.reasonKey ? { fieldErrors: { _form: [known.reasonKey] } } : undefined,
    );
  }
  return dbFail(event, error, fields);
}

/** Auth·Storage 후속 처리 실패: DB 는 이미 바뀌었으므로 기록을 남기고 다시 시도하도록 알린다 */
function followUpFail(event: string, code: string | undefined, objectId?: string) {
  const ref = newRef();
  logger.warn(event, { ref, objectId, dbCode: code });
  return fail('INTERNAL', { ref });
}

async function adminGuard(): Promise<ActionResult<never> | null> {
  if (!(await getSessionUserId())) return fail('UNAUTHENTICATED');
  return (await isPlatformAdmin()) ? null : fail('FORBIDDEN');
}

// ── A4 업체 소유자 변경 ───────────────────────────────────────────
export async function changeCompanyOwner(raw: unknown): Promise<ActionResult<void>> {
  const parsed = parseInput(changeOwnerSchema, raw);
  if (!parsed.ok) return parsed.result;
  const denied = await adminGuard();
  if (denied) return denied;
  const { companyId, newOwnerId } = parsed.data;
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('admin_change_company_owner', {
    p_company: companyId,
    p_new_owner: newOwnerId,
  });
  if (error) return rpcFail('admin.owner_change.failed', error, { companyId });
  revalidatePath(routes.admin.company(companyId));
  revalidatePath(routes.admin.companies());
  return ok(undefined);
}

// ── A6 업체별 저장공간 한도 ────────────────────────────────────────
export async function setCompanyQuota(raw: unknown): Promise<ActionResult<void>> {
  const parsed = parseInput(companyQuotaSchema, raw);
  if (!parsed.ok) return parsed.result;
  const denied = await adminGuard();
  if (denied) return denied;
  const { companyId, quotaGb } = parsed.data;
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('admin_set_company_quota', {
    p_company: companyId,
    p_quota_bytes: gbToBytes(quotaGb) as number,
  });
  if (error) return rpcFail('admin.quota.failed', error, { companyId });
  revalidatePath(routes.admin.company(companyId));
  return ok(undefined);
}

// ── A5 정지·해제 (DB 표시 + 로그인 차단) ───────────────────────────
export async function setUserSuspended(raw: unknown): Promise<ActionResult<void>> {
  const parsed = parseInput(suspendSchema, raw);
  if (!parsed.ok) return parsed.result;
  const denied = await adminGuard();
  if (denied) return denied;
  const { userId, suspended } = parsed.data;
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('admin_set_user_suspended', {
    p_user: userId,
    p_suspended: suspended,
  });
  if (error) return rpcFail('admin.suspend.failed', error, { objectId: userId });
  const auth = await setLoginBlocked(userId, suspended);
  if (!auth.ok) return followUpFail('admin.suspend.auth_failed', auth.code, userId);
  revalidatePath(routes.admin.users());
  return ok(undefined);
}

// ── A5 익명화 (삭제 대신) ──────────────────────────────────────────
export async function anonymizeUser(raw: unknown): Promise<ActionResult<void>> {
  const parsed = parseInput(userTargetSchema, raw);
  if (!parsed.ok) return parsed.result;
  const denied = await adminGuard();
  if (denied) return denied;
  const { userId } = parsed.data;
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('admin_anonymize_user', { p_user: userId });
  if (error) return rpcFail('admin.anonymize.failed', error, { objectId: userId });
  const auth = await anonymizeAuthUser(userId);
  if (!auth.ok) return followUpFail('admin.anonymize.auth_failed', auth.code, userId);
  revalidatePath(routes.admin.users());
  return ok(undefined);
}

// ── A5 비밀번호 재설정 링크 (관리자가 받아서 직접 전달) ─────────────
export async function issuePasswordResetLink(
  raw: unknown,
): Promise<ActionResult<{ link: string }>> {
  const parsed = parseInput(userTargetSchema, raw);
  if (!parsed.ok) return parsed.result;
  const denied = await adminGuard();
  if (denied) return denied;
  const { userId } = parsed.data;
  const token = await createRecoveryToken(userId);
  if (!token.ok)
    return token.code === 'user_not_found'
      ? fail('NOT_FOUND')
      : followUpFail('admin.reset_link.failed', token.code, userId);
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('admin_log_password_reset', { p_user: userId });
  if (error) return rpcFail('admin.reset_link.log_failed', error, { objectId: userId });
  const q = new URLSearchParams({
    token_hash: token.hashedToken,
    type: 'recovery',
    next: routes.resetPassword(),
  });
  return ok({ link: `${appOrigin()}${routes.authConfirm()}?${q.toString()}` });
}

// ── A6 사이트 설정 ────────────────────────────────────────────────
export async function updateSiteSettings(raw: unknown): Promise<ActionResult<void>> {
  const parsed = parseInput(siteSettingsSchema, raw);
  if (!parsed.ok) return parsed.result;
  const denied = await adminGuard();
  if (denied) return denied;
  const v = parsed.data;
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('admin_update_site_settings', {
    p_photo_max_bytes: mbToBytes(v.photoMaxMb),
    p_photo_batch_max: v.photoBatchMax,
    p_design_max_bytes: mbToBytes(v.designMaxMb),
    p_default_quota_bytes: gbToBytes(v.defaultQuotaGb) as number,
  });
  if (error) return rpcFail('admin.settings.failed', error);
  revalidatePath(routes.admin.settings());
  return ok(undefined);
}

// ── A7 정리: 저장소 객체를 먼저 지우고 DB 행을 정리한다 ──────────────
export async function purgeFiles(raw: unknown): Promise<ActionResult<{ purged: number }>> {
  const parsed = parseInput(purgeFilesSchema, raw);
  if (!parsed.ok) return parsed.result;
  const denied = await adminGuard();
  if (denied) return denied;
  // 화면이 보낸 id 중 지금도 후보인 것만 (그 사이 연결된 파일은 건드리지 않는다)
  const wanted = new Set(parsed.data.fileIds);
  const targets = (await listCleanupCandidates()).filter((f) => wanted.has(f.id));
  if (targets.length === 0) return ok({ purged: 0 });
  const removed = await removeStorageObjects(groupPathsByBucket(targets));
  if (!removed.ok) return followUpFail('admin.purge.storage_failed', removed.code);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('admin_purge_files', {
    p_ids: targets.map((f) => f.id),
  });
  if (error) return rpcFail('admin.purge.failed', error);
  revalidatePath(routes.admin.cleanup());
  return ok({ purged: data ?? 0 });
}

export async function purgeReadNotifications(): Promise<ActionResult<{ purged: number }>> {
  const denied = await adminGuard();
  if (denied) return denied;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('admin_purge_read_notifications', { p_days: 90 });
  if (error) return rpcFail('admin.notifications_purge.failed', error);
  revalidatePath(routes.admin.cleanup());
  return ok({ purged: data ?? 0 });
}

// ── A10 본인 탈퇴 (useActionState 폼) ─────────────────────────────
export async function withdrawMe(
  _prev: ActionResult<void> | null,
  form: FormData,
): Promise<ActionResult<void>> {
  if (form.get('confirm') !== 'on')
    return fail('VALIDATION_FAILED', { fieldErrors: { confirm: ['field.required'] } });
  const userId = await getSessionUserId();
  if (!userId) return fail('UNAUTHENTICATED');
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('withdraw_me');
  if (error) return rpcFail('account.withdraw.failed', error, { objectId: userId });
  const auth = await anonymizeAuthUser(userId);
  if (!auth.ok) return followUpFail('account.withdraw.auth_failed', auth.code, userId);
  await supabase.auth.signOut({ scope: 'global' });
  redirect(routes.landing());
}

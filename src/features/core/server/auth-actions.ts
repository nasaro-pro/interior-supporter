'use server';
// src/features/core/server/auth-actions.ts (A · TASK-004·008·015) — service_role 허용 파일 (03 문서 2.2, TC-909)
// admin 을 쓰는 모든 함수는 호출 전에 권한·입력을 스스로 확인한다 (헌법 9.3).
// A-08: 이 파일의 export 는 전부 공개 Server Action 이다 — 조회 함수(getInvitationPreview)는
//       server-only 모듈 invitation-queries.ts 로 옮겼다. 여기에는 액션만 둔다.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createAdminSupabase } from '@/shared/lib/supabase/admin';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { fail, ok, mapDbError, type ActionResult } from '@/shared/contracts/errors';
import { routes } from '@/shared/contracts/routes';
import { SIGNUP_RATE_LIMIT } from '@/shared/contracts/domain';
import { hitRateLimit, clientIp } from '@/shared/lib/rate-limit';
import { formToObject, parseInput } from '@/shared/lib/action';
import { logger, newRef } from '@/shared/lib/logger';
import {
  acceptNewAccountSchema,
  changePasswordSchema,
  externalAccountSchema,
  resendTempPasswordSchema,
  resetLinkSchema,
  signupSchema,
} from '../schema';
import {
  firstLoginState,
  makeCompanySlug,
  makeTempPassword,
  TEMP_PASSWORD_HOURS,
  tempPasswordExpiry,
} from '../account-utils';
import { findProjectAccess, loadAccessContext } from './access';
import { accountMail, assignedMail, sendMail, type MailResult } from './mail';
import { INVITE_TOKEN_RE, getInvitationPreview, sha256 } from './invitation-queries';
import { levelFailureTiming } from './timing';

/** A-08: 로그인 사용자 초대 수락 요청 제한 (사용자별, 1시간) */
const INVITE_ACCEPT_PER_USER_PER_HOUR = 10;
const appOrigin = () => process.env.APP_ORIGIN ?? 'http://localhost:3000';

// ── REQ-001 업체 셀프 가입 ─────────────────────────────────────────────
/**
 * A-03: 가입 실패의 단일 중립 응답 (CONFLICT + ref). 화면 문구: auth.signup.unavailable
 * 응답 시간도 맞춘다 — 요청 시작(startedAt)부터 최소 시간이 지난 뒤 응답 (timing.ts)
 */
async function neutralSignupFailure(
  startedAt: number,
  msg: string,
  code?: string,
  userId?: string,
): Promise<ActionResult<never>> {
  const ref = newRef();
  logger.warn(msg, { ref, code, userId });
  await levelFailureTiming(startedAt);
  return fail('CONFLICT', { ref });
}

export async function signupCompany(
  _prev: ActionResult<never> | null,
  form: FormData,
): Promise<ActionResult<never>> {
  const ip = await clientIp();
  const limit = hitRateLimit(`signup:${ip}`, SIGNUP_RATE_LIMIT.perIpPerHour, 60 * 60 * 1000);
  if (!limit.ok) return fail('RATE_LIMITED');

  const parsed = parseInput(signupSchema, formToObject(form));
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const startedAt = Date.now();

  const admin = createAdminSupabase();
  // D-10: 업체 주소는 사용자가 입력하지 않는다 — 이메일 앞부분 + 임의 4자로 만들고, 겹치면 다시 만든다.
  //       (계정 생성 전에 확인하므로 겹침이 이메일 존재를 드러내지 않는다 — A-03)
  let slug: string | null = null;
  for (let i = 0; i < 5 && !slug; i++) {
    const candidate = makeCompanySlug(v.email);
    const taken = await admin.from('companies').select('id').eq('slug', candidate).maybeSingle();
    if (taken.error)
      return neutralSignupFailure(startedAt, 'auth.signup.slug_check_failed', taken.error.code);
    if (!taken.data) slug = candidate;
  }
  if (!slug) return neutralSignupFailure(startedAt, 'auth.signup.slug_exhausted');

  const created = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true, // ADR-004: 메일 확인 없음 (사용자 결정, THR-004 수용)
    user_metadata: { display_name: v.displayName, locale: 'ko' },
  });
  if (created.error || !created.data.user) {
    // A-03: 이미 있는 이메일(422)과 다른 오류를 같은 응답으로 — 존재 여부를 드러내지 않는다
    return neutralSignupFailure(startedAt, 'auth.signup.create_user_failed', created.error?.code);
  }
  const userId = created.data.user.id;

  const rpc = await admin.rpc('create_company_with_owner', {
    p_user: userId,
    p_company_name: v.companyName,
    p_slug: slug,
    p_display_name: v.displayName,
  });
  if (rpc.error) {
    // REQ-001: 업체 생성 실패 시 계정 삭제(보상)
    await admin.auth.admin.deleteUser(userId);
    const code = mapDbError(rpc.error);
    // 사전 확인과 생성 사이에 같은 주소가 먼저 만들어진 경우(드묾) — 다시 시도하면 새 주소로 만든다
    if (code === 'SLUG_TAKEN') return neutralSignupFailure(startedAt, 'auth.signup.slug_race');
    return neutralSignupFailure(
      startedAt,
      'auth.signup.create_company_failed',
      rpc.error.code,
      userId,
    );
  }

  const supabase = await createServerSupabase();
  const signIn = await supabase.auth.signInWithPassword({ email: v.email, password: v.password });
  if (signIn.error) redirect(routes.login());
  // D-11: 새 업체는 사이트 관리자 승인 전까지 '승인 대기' — 영역 선택 화면이 안내한다
  redirect(routes.selectArea());
}

// ── REQ-004 초대 수락 ──────────────────────────────────────────────────
// 미리보기(getInvitationPreview)는 invitation-queries.ts (server-only, A-08)

type AcceptResult = {
  company_id: string;
  project_id: string | null;
  area: 'app' | 'portal' | 'field';
};

async function destinationAfterAccept(r: AcceptResult): Promise<string> {
  if (r.area === 'portal' && r.project_id) return routes.portal.project(r.project_id, 'home');
  if (r.area === 'field' && r.project_id) return routes.field.photos(r.project_id);
  const admin = createAdminSupabase();
  const { data } = await admin
    .from('companies')
    .select('slug')
    .eq('id', r.company_id)
    .maybeSingle();
  return data ? routes.app.projects(data.slug) : routes.selectArea();
}

/** 신규 계정: 초대 이메일로 계정 생성 → 수락 RPC → 로그인 */
export async function acceptInvitationWithNewAccount(
  _prev: ActionResult<never> | null,
  form: FormData,
): Promise<ActionResult<never>> {
  const ip = await clientIp();
  if (!hitRateLimit(`invite:${ip}`, 10, 60 * 60 * 1000).ok) return fail('RATE_LIMITED');
  const parsed = parseInput(acceptNewAccountSchema, formToObject(form));
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const startedAt = Date.now();

  const preview = await getInvitationPreview(v.token);
  if (preview.status === 'used') return fail('INVITE_USED');
  if (preview.status !== 'valid') return fail('INVITE_INVALID');

  const admin = createAdminSupabase();
  const created = await admin.auth.admin.createUser({
    email: preview.email,
    password: v.password,
    email_confirm: true,
    user_metadata: { display_name: v.displayName, locale: 'ko' },
  });
  if (created.error || !created.data.user) {
    // A-03: 이미 계정이 있음(422)·기타 오류를 같은 응답으로 — 화면은 "계정이 있다면 로그인 후 수락" 안내
    return neutralSignupFailure(startedAt, 'auth.invite.create_user_failed', created.error?.code);
  }
  const userId = created.data.user.id;
  const rpc = await admin.rpc('accept_invitation', {
    p_user: userId,
    p_token_hash: sha256(v.token),
  });
  if (rpc.error) {
    await admin.auth.admin.deleteUser(userId); // 보상
    await levelFailureTiming(startedAt); // A-03: 실패 응답 시간 평준화
    return fail(mapDbError(rpc.error));
  }
  const supabase = await createServerSupabase();
  await supabase.auth.signInWithPassword({ email: preview.email, password: v.password });
  redirect(await destinationAfterAccept(rpc.data as unknown as AcceptResult));
}

/** 기존 계정: 로그인 상태에서 수락 (이메일 일치는 RPC 가 검사) */
export async function acceptInvitationAsCurrentUser(token: string): Promise<ActionResult<never>> {
  const ctx = await loadAccessContext();
  if (!ctx) return fail('UNAUTHENTICATED');
  // A-08: 사용자별 요청 제한 — 토큰 대입 시도를 막는다 (토큰 형식 검사보다 먼저 센다)
  const limit = hitRateLimit(
    `invite:user:${ctx.userId}`,
    INVITE_ACCEPT_PER_USER_PER_HOUR,
    60 * 60 * 1000,
  );
  if (!limit.ok) return fail('RATE_LIMITED');
  if (typeof token !== 'string' || !INVITE_TOKEN_RE.test(token)) return fail('INVITE_INVALID');
  const admin = createAdminSupabase();
  const rpc = await admin.rpc('accept_invitation', {
    p_user: ctx.userId,
    p_token_hash: sha256(token),
  });
  if (rpc.error) return fail(mapDbError(rpc.error));
  redirect(await destinationAfterAccept(rpc.data as unknown as AcceptResult));
}

// ── REQ-005 재설정 링크 (owner/manager → 자기 업체 사용자, 소유자 제외) ───────
export async function createPasswordResetLink(
  raw: unknown,
): Promise<ActionResult<{ link: string }>> {
  const parsed = parseInput(resetLinkSchema, raw);
  if (!parsed.ok) return parsed.result;
  const ctx = await loadAccessContext();
  if (!ctx) return fail('UNAUTHENTICATED');
  const { companyId, targetUserId } = parsed.data;

  const admin = createAdminSupabase();
  const check = await admin.rpc('can_issue_password_reset', {
    p_actor: ctx.userId,
    p_company: companyId,
    p_target: targetUserId,
  });
  if (check.error || check.data !== true) return fail('FORBIDDEN');

  const user = await admin.auth.admin.getUserById(targetUserId);
  const email = user.data.user?.email;
  if (!email) return fail('NOT_FOUND');
  const link = await admin.auth.admin.generateLink({ type: 'recovery', email });
  const hashed = link.data?.properties?.hashed_token;
  if (link.error || !hashed) {
    const ref = newRef();
    logger.warn('auth.reset_link.failed', { ref, companyId, userId: ctx.userId });
    return fail('INTERNAL', { ref });
  }
  const q = new URLSearchParams({
    token_hash: hashed,
    type: 'recovery',
    next: routes.resetPassword(),
  });
  logger.info('auth.reset_link.created', { companyId, userId: ctx.userId, objectId: targetUserId });
  return ok({ link: `${appOrigin()}${routes.authConfirm()}?${q.toString()}` });
}

// ── D-12 디자이너가 고객·시공팀 계정 만들기 (초대 링크 대체) ──────────────────
// 1) 편집자 확인 → 2) admin 으로 계정 생성(임시 비밀번호, 이미 있으면 그 계정 사용)
// 3) 디자이너 세션으로 assign_external_participant RPC (RLS·권한은 DB 가 다시 검사)
// 4) 메일 발송. 메일이 설정되지 않았거나 실패하면 임시 비밀번호를 디자이너 화면에 한 번만 돌려준다
export type ExternalAccountResult = {
  created: boolean;
  mail: MailResult;
  /** 메일로 보내지 못했을 때만 — 화면에 한 번 표시 후 버린다 */
  tempPassword: string | null;
  email: string;
};

const EXTERNAL_ACCOUNT_PER_USER_PER_HOUR = 30;

async function projectAndCompanyNames(projectId: string, companyId: string) {
  const supabase = await createServerSupabase();
  const [p, c] = await Promise.all([
    supabase.from('projects').select('name').eq('id', projectId).maybeSingle(),
    supabase.from('companies').select('name').eq('id', companyId).maybeSingle(),
  ]);
  return { projectName: p.data?.name ?? '', companyName: c.data?.name ?? '' };
}

export async function createExternalAccount(
  _prev: ActionResult<ExternalAccountResult> | null,
  form: FormData,
): Promise<ActionResult<ExternalAccountResult>> {
  const parsed = parseInput(externalAccountSchema, formToObject(form));
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const ctx = await loadAccessContext();
  const access = await findProjectAccess(v.projectId, ['editor']);
  if (!ctx || !access) return fail('NOT_FOUND');
  const limit = hitRateLimit(
    `external-account:${ctx.userId}`,
    EXTERNAL_ACCOUNT_PER_USER_PER_HOUR,
    60 * 60 * 1000,
  );
  if (!limit.ok) return fail('RATE_LIMITED');

  const admin = createAdminSupabase();
  const tempPassword = makeTempPassword();
  const created = await admin.auth.admin.createUser({
    email: v.email,
    password: tempPassword,
    email_confirm: true, // 메일로 받은 임시 비밀번호로 로그인하는 것이 이메일 확인을 대신한다
    user_metadata: { display_name: v.displayName, locale: ctx.locale },
  });
  const exists =
    !!created.error && (created.error.code === 'email_exists' || created.error.status === 422);
  if (created.error && !exists) {
    const ref = newRef();
    logger.warn('auth.external_account.create_failed', {
      ref,
      projectId: v.projectId,
      code: created.error.code,
    });
    return fail('INTERNAL', { ref });
  }
  const newUserId = created.data?.user?.id ?? null;
  if (newUserId) {
    const flag = await admin
      .from('profiles')
      .update({ must_change_password: true, temp_password_expires_at: tempPasswordExpiry() })
      .eq('id', newUserId);
    if (flag.error) {
      await admin.auth.admin.deleteUser(newUserId); // 보상
      return fail('INTERNAL', { ref: newRef() });
    }
  }

  const supabase = await createServerSupabase();
  const rpc = await supabase.rpc('assign_external_participant', {
    p_project: v.projectId,
    p_email: v.email,
    p_role: v.role,
    p_can_confirm: v.role === 'customer' && v.canConfirm,
    p_valid_from: v.validFrom,
    p_valid_until: v.validUntil,
  });
  if (rpc.error) {
    if (newUserId) await admin.auth.admin.deleteUser(newUserId); // 보상: 배정 실패면 새 계정도 지운다
    const msg = (rpc.error.message ?? '').trim();
    if (msg === 'scope_mismatch')
      return fail('VALIDATION_FAILED', { fieldErrors: { email: ['field.staffEmail'] } });
    return fail(mapDbError(rpc.error));
  }

  const names = await projectAndCompanyNames(v.projectId, access.companyId);
  const loginUrl = `${appOrigin()}${routes.login()}`;
  const mail = await sendMail(
    newUserId
      ? accountMail({
          locale: ctx.locale,
          to: v.email,
          displayName: v.displayName,
          ...names,
          tempPassword,
          loginUrl,
          expiresHours: TEMP_PASSWORD_HOURS,
        })
      : assignedMail({
          locale: ctx.locale,
          to: v.email,
          displayName: v.displayName,
          ...names,
          loginUrl,
        }),
  );
  logger.info('auth.external_account.assigned', {
    projectId: v.projectId,
    userId: ctx.userId,
    objectId: newUserId ?? undefined,
  });
  revalidatePath(routes.app.project(access.companySlug, v.projectId, 'settings'));
  return ok({
    created: Boolean(newUserId),
    mail,
    tempPassword: newUserId && mail !== 'sent' ? tempPassword : null,
    email: v.email,
  });
}

// ── D-16 임시 비밀번호 재발송 (첫 로그인 변경 전인 고객·시공팀만) ────────────────
export async function resendTempPassword(
  raw: unknown,
): Promise<ActionResult<Omit<ExternalAccountResult, 'created'>>> {
  const parsed = parseInput(resendTempPasswordSchema, raw);
  if (!parsed.ok) return parsed.result;
  const { projectId, userId } = parsed.data;
  const ctx = await loadAccessContext();
  const access = await findProjectAccess(projectId, ['editor']);
  if (!ctx || !access) return fail('NOT_FOUND');
  if (!hitRateLimit(`temp-resend:${ctx.userId}`, 20, 60 * 60 * 1000).ok)
    return fail('RATE_LIMITED');

  // 이 프로젝트의 고객·시공팀인지 디자이너 세션으로 확인 (RLS)
  const supabase = await createServerSupabase();
  const { data: part } = await supabase
    .from('project_participants')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .in('role', ['customer', 'field'])
    .limit(1)
    .maybeSingle();
  if (!part) return fail('NOT_FOUND');

  const admin = createAdminSupabase();
  const { data: profile } = await admin
    .from('profiles')
    .select('display_name, must_change_password, temp_password_expires_at')
    .eq('id', userId)
    .maybeSingle();
  // 이미 자기 비밀번호를 정한 계정은 재발송하지 않는다 (재설정 링크를 쓴다)
  if (!profile || firstLoginState(profile) === 'ready') return fail('CONFLICT');
  const user = await admin.auth.admin.getUserById(userId);
  const email = user.data.user?.email;
  if (!email) return fail('NOT_FOUND');

  const tempPassword = makeTempPassword();
  const upd = await admin.auth.admin.updateUserById(userId, { password: tempPassword });
  if (upd.error) return fail('INTERNAL', { ref: newRef() });
  await admin
    .from('profiles')
    .update({ must_change_password: true, temp_password_expires_at: tempPasswordExpiry() })
    .eq('id', userId);

  const names = await projectAndCompanyNames(projectId, access.companyId);
  const mail = await sendMail(
    accountMail({
      locale: ctx.locale,
      to: email,
      displayName: profile.display_name,
      ...names,
      tempPassword,
      loginUrl: `${appOrigin()}${routes.login()}`,
      expiresHours: TEMP_PASSWORD_HOURS,
    }),
  );
  logger.info('auth.temp_password.resent', { projectId, userId: ctx.userId, objectId: userId });
  return ok({ mail, tempPassword: mail === 'sent' ? null : tempPassword, email });
}

// ── D-15 첫 로그인 비밀번호 변경 (AUTH-06) ──────────────────────────────
// 임시 비밀번호(현재 비밀번호)를 다시 확인 → 새 비밀번호 → 표시 해제(service_role) → 다른 세션 종료
export async function completeFirstPassword(
  _prev: ActionResult<never> | null,
  form: FormData,
): Promise<ActionResult<never>> {
  const parsed = parseInput(changePasswordSchema, formToObject(form));
  if (!parsed.ok) return parsed.result;
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!data.user || !email) return fail('UNAUTHENTICATED');
  if (!hitRateLimit(`pwfirst:${data.user.id}`, 10, 15 * 60 * 1000).ok) return fail('RATE_LIMITED');

  const admin = createAdminSupabase();
  const { data: profile } = await admin
    .from('profiles')
    .select('must_change_password, temp_password_expires_at')
    .eq('id', data.user.id)
    .maybeSingle();
  const state = firstLoginState(profile ?? null);
  if (state === 'ready') redirect(routes.selectArea());
  if (state === 'expired') {
    await supabase.auth.signOut();
    return fail('FORBIDDEN', { fieldErrors: { currentPassword: ['field.tempPasswordExpired'] } });
  }

  const verify = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.currentPassword,
  });
  if (verify.error)
    return fail('VALIDATION_FAILED', { fieldErrors: { currentPassword: ['field.invalid'] } });
  if (parsed.data.currentPassword === parsed.data.password)
    return fail('VALIDATION_FAILED', { fieldErrors: { password: ['field.sameAsTemp'] } });

  const upd = await supabase.auth.updateUser({ password: parsed.data.password });
  if (upd.error)
    return fail('VALIDATION_FAILED', { fieldErrors: { password: ['field.passwordCommon'] } });
  const clear = await admin
    .from('profiles')
    .update({ must_change_password: false, temp_password_expires_at: null })
    .eq('id', data.user.id);
  if (clear.error) {
    const ref = newRef();
    logger.warn('auth.first_password.clear_failed', { ref, userId: data.user.id });
    return fail('INTERNAL', { ref });
  }
  await supabase.auth.signOut({ scope: 'others' }); // POL-033
  redirect(routes.selectArea());
}

'use server';
// src/features/core/server/auth-actions.ts (A · TASK-004·008·015) — service_role 허용 파일 (03 문서 2.2, TC-909)
// admin 을 쓰는 모든 함수는 호출 전에 권한·입력을 스스로 확인한다 (헌법 9.3).
// A-08: 이 파일의 export 는 전부 공개 Server Action 이다 — 조회 함수(getInvitationPreview)는
//       server-only 모듈 invitation-queries.ts 로 옮겼다. 여기에는 액션만 둔다.
import { redirect } from 'next/navigation';
import { createAdminSupabase } from '@/shared/lib/supabase/admin';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { fail, ok, mapDbError, type ActionResult } from '@/shared/contracts/errors';
import { routes } from '@/shared/contracts/routes';
import { SIGNUP_RATE_LIMIT } from '@/shared/contracts/domain';
import { hitRateLimit, clientIp } from '@/shared/lib/rate-limit';
import { formToObject, parseInput } from '@/shared/lib/action';
import { logger, newRef } from '@/shared/lib/logger';
import { acceptNewAccountSchema, resetLinkSchema, signupSchema } from '../schema';
import { loadAccessContext } from './access';
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
  // A-03: 주소명 중복은 계정을 만들기 전에 확인한다 — 계정 생성 뒤에 SLUG_TAKEN 을 돌려주면
  //       "그 이메일은 아직 없다"가 드러난다 (이메일 존재 노출 방지)
  const taken = await admin.from('companies').select('id').eq('slug', v.slug).maybeSingle();
  if (taken.error)
    return neutralSignupFailure(startedAt, 'auth.signup.slug_check_failed', taken.error.code);
  if (taken.data) return fail('SLUG_TAKEN', { fieldErrors: { slug: ['field.slugTaken'] } });

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
    p_slug: v.slug,
    p_display_name: v.displayName,
  });
  if (rpc.error) {
    // REQ-001: 업체 생성 실패 시 계정 삭제(보상)
    await admin.auth.admin.deleteUser(userId);
    const code = mapDbError(rpc.error);
    // 사전 확인과 생성 사이에 같은 주소명이 먼저 만들어진 경우(드묾)만 SLUG_TAKEN
    if (code === 'SLUG_TAKEN')
      return fail('SLUG_TAKEN', { fieldErrors: { slug: ['field.slugTaken'] } });
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
  redirect(routes.app.projects(v.slug));
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

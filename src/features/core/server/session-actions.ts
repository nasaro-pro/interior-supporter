'use server';
// src/features/core/server/session-actions.ts (A · TASK-001·004·008·015) — 사용자 세션 클라이언트만 사용 (admin 없음)
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { fail, ok, type ActionResult } from '@/shared/contracts/errors';
import { routes, safeNext } from '@/shared/contracts/routes';
import { LOGIN_RATE_LIMIT } from '@/shared/contracts/domain';
import { LOCALE_COOKIE } from '@/i18n/request';
import { clientIp, hitRateLimit } from '@/shared/lib/rate-limit';
import { formToObject, parseInput } from '@/shared/lib/action';
import { logger, newRef } from '@/shared/lib/logger';
import { changePasswordSchema, localeSchema, loginSchema, newPasswordSchema } from '../schema';
import { loadAccessContext } from './access';
import { readRecoveryProof } from './recovery-proof';
import { LAST_COMPANY_COOKIE } from '../constants';

const YEAR = 60 * 60 * 24 * 365;

// ── REQ-002 로그인·로그아웃 ────────────────────────────────────────────
export async function login(
  _prev: ActionResult<never> | null,
  form: FormData,
): Promise<ActionResult<never>> {
  const parsed = parseInput(loginSchema, formToObject(form));
  if (!parsed.ok) return parsed.result;
  const { email, password, next } = parsed.data;

  const ip = await clientIp();
  const byIp = hitRateLimit(`login:ip:${ip}`, LOGIN_RATE_LIMIT.perIpPer15Min, 15 * 60 * 1000);
  const byEmail = hitRateLimit(
    `login:email:${email}`,
    LOGIN_RATE_LIMIT.perEmailPer15Min,
    15 * 60 * 1000,
  );
  if (!byIp.ok || !byEmail.ok) return fail('RATE_LIMITED');

  const supabase = await createServerSupabase();
  const { data: signed, error } = await supabase.auth.signInWithPassword({ email, password });
  // 계정 존재 여부를 드러내지 않는 단일 문구 (REQ-002)
  if (error) return fail('UNAUTHENTICATED');

  // REQ-008: 저장된 언어(profiles.locale)를 쿠키에 맞춘다
  const { data: profile } = await supabase
    .from('profiles')
    .select('locale')
    .eq('id', signed.user.id)
    .maybeSingle();
  if (profile?.locale === 'ko' || profile?.locale === 'en') {
    (await cookies()).set(LOCALE_COOKIE, profile.locale, {
      sameSite: 'lax',
      path: '/',
      maxAge: YEAR,
    });
  }

  // next(같은 사이트 경로만) > 영역 선택(영역 1개면 그 화면이 바로 이동시킴)
  redirect(safeNext(next, routes.selectArea()));
}

export async function logout(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect(`${routes.login()}?loggedOut=1`);
}

// ── REQ-007 영역 선택 (마지막 업체 기억) ─────────────────────────────
export async function chooseArea(area: 'app' | 'portal' | 'field', companySlug?: string) {
  const ctx = await loadAccessContext();
  if (!ctx) redirect(routes.login());
  if (area === 'app') {
    const m = ctx.memberships.find((x) => x.slug === companySlug) ?? ctx.memberships[0];
    if (!m) redirect(routes.selectArea());
    (await cookies()).set(LAST_COMPANY_COOKIE, m.slug, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: YEAR,
    });
    redirect(routes.app.projects(m.slug));
  }
  if (area === 'portal' && ctx.areas.includes('portal')) redirect(routes.portal.projects());
  if (area === 'field' && ctx.areas.includes('field')) redirect(routes.field.photos());
  redirect(routes.selectArea());
}

// ── REQ-006 비밀번호 변경 (현재 비밀번호 확인 → 변경 → 다른 세션 종료) ─────────
export async function changePassword(
  _prev: ActionResult<null> | null,
  form: FormData,
): Promise<ActionResult<null>> {
  const parsed = parseInput(changePasswordSchema, formToObject(form));
  if (!parsed.ok) return parsed.result;
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!data.user || !email) return fail('UNAUTHENTICATED');

  const limit = hitRateLimit(`pwchange:${data.user.id}`, 10, 15 * 60 * 1000);
  if (!limit.ok) return fail('RATE_LIMITED');

  const verify = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.currentPassword,
  });
  if (verify.error)
    return fail('VALIDATION_FAILED', { fieldErrors: { currentPassword: ['field.invalid'] } });

  const upd = await supabase.auth.updateUser({ password: parsed.data.password });
  if (upd.error) {
    const ref = newRef();
    logger.warn('auth.password_change.failed', { ref, userId: data.user.id, code: upd.error.code });
    return fail('VALIDATION_FAILED', { ref, fieldErrors: { password: ['field.passwordCommon'] } });
  }
  await supabase.auth.signOut({ scope: 'others' }); // POL-033
  return ok(null);
}

// ── REQ-005 재설정 링크로 들어온 뒤 새 비밀번호 설정 (AUTH-04) ───────────────
// SEC-02: 로그인 세션만으로는 안 된다. 재설정 링크(/auth/confirm verifyOtp)로 10분 안에 만든 세션만 허용
// (amr 증명 — recovery-proof.ts). 성공하면 새 비밀번호로 다시 로그인해 증명을 소모하고 다른 세션을 끝낸다.
export async function resetPassword(
  _prev: ActionResult<never> | null,
  form: FormData,
): Promise<ActionResult<never>> {
  const parsed = parseInput(newPasswordSchema, formToObject(form));
  if (!parsed.ok) return parsed.result;
  const supabase = await createServerSupabase();
  const proof = await readRecoveryProof(supabase);
  if (proof.status === 'none') return fail('UNAUTHENTICATED');
  if (proof.status === 'denied') {
    logger.info('auth.password_reset.no_proof', { userId: proof.userId });
    return fail('FORBIDDEN');
  }

  const limit = hitRateLimit(`pwreset:${proof.userId}`, 5, 15 * 60 * 1000);
  if (!limit.ok) return fail('RATE_LIMITED');

  const upd = await supabase.auth.updateUser({ password: parsed.data.password });
  if (upd.error) {
    return fail('VALIDATION_FAILED', { fieldErrors: { password: ['field.passwordCommon'] } });
  }
  // 증명 소모: 새 비밀번호 세션(amr=password)으로 바꾼 뒤 나머지(재설정 세션 포함)를 끝낸다 (POL-033)
  const relogin = await supabase.auth.signInWithPassword({
    email: proof.email,
    password: parsed.data.password,
  });
  if (relogin.error) {
    const ref = newRef();
    logger.warn('auth.password_reset.relogin_failed', { ref, userId: proof.userId });
    await supabase.auth.signOut({ scope: 'global' });
    redirect(`${routes.login()}?reset=1`);
  }
  await supabase.auth.signOut({ scope: 'others' });
  redirect(`${routes.selectArea()}?reset=1`);
}

// ── REQ-008 언어 전환 (쿠키 + profiles.locale) ─────────────────────────
export async function setLocale(raw: unknown): Promise<ActionResult<null>> {
  const parsed = parseInput(localeSchema, raw);
  if (!parsed.ok) return parsed.result;
  const { locale } = parsed.data;
  (await cookies()).set(LOCALE_COOKIE, locale, { sameSite: 'lax', path: '/', maxAge: YEAR });

  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    const { error } = await supabase.from('profiles').update({ locale }).eq('id', data.user.id);
    if (error)
      logger.warn('profile.locale.update_failed', { userId: data.user.id, dbCode: error.code });
  }
  revalidatePath('/', 'layout');
  return ok(null);
}

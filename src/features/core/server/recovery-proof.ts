// src/features/core/server/recovery-proof.ts (A · SEC-02) — "이 세션은 재설정 링크(/auth/confirm)로 방금 만들어졌다" 증명
// 실측(2026-10-13, dev 프로젝트): recovery verifyOtp 로 만든 세션의 access token amr = [{ method: 'otp', timestamp }],
// 비밀번호 로그인 세션은 [{ method: 'password', timestamp }]. timestamp 는 refresh 해도 바뀌지 않는다.
// → 새 비밀(env) 없이 서명 검증된 JWT 의 amr 로 판정한다. 앱은 매직 링크·OTP 로그인을 제공하지 않으므로
//   'otp' 는 재설정 링크(또는 같은 수준의 메일 소유 증명)로만 생긴다.
// 1회성: resetPassword 가 성공하면 새 비밀번호로 다시 로그인(amr=password)하고 다른 세션(재설정 세션 포함)을 끝낸다.
import 'server-only';

/** 재설정 링크 확인 후 새 비밀번호를 정할 수 있는 시간 (초) */
export const RECOVERY_PROOF_WINDOW_SEC = 10 * 60;
/** 서버·Auth 시계 차이 허용 (초) */
const CLOCK_SKEW_SEC = 60;
const RECOVERY_METHODS = new Set(['otp', 'recovery']);

/** amr 클레임에 window 안의 otp/recovery 인증이 있는가 (순수 함수 — 테스트 대상) */
export function hasRecoveryAmr(
  claims: { amr?: unknown } | null | undefined,
  nowSec: number,
  windowSec: number = RECOVERY_PROOF_WINDOW_SEC,
): boolean {
  const amr = claims?.amr;
  if (!Array.isArray(amr)) return false;
  return amr.some((e: unknown) => {
    // RFC 8176 문자열 형식은 시각이 없어 판정할 수 없다 → 거부
    if (!e || typeof e !== 'object') return false;
    const { method, timestamp } = e as { method?: unknown; timestamp?: unknown };
    if (typeof method !== 'string' || !RECOVERY_METHODS.has(method)) return false;
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return false;
    return timestamp <= nowSec + CLOCK_SKEW_SEC && nowSec - timestamp <= windowSec;
  });
}

type ClaimsClient = { auth: { getClaims: () => Promise<{ data: unknown; error: unknown }> } };
type Claims = { sub?: string; email?: string; amr?: unknown };

export type RecoveryProof =
  | { status: 'ok'; userId: string; email: string }
  | { status: 'none' } // 로그인 세션 없음
  | { status: 'denied'; userId: string }; // 로그인은 됐지만 재설정 링크 세션이 아님(또는 만료)

/** 서명 검증된 클레임(getClaims)으로 판정. getSession() 의 쿠키 값은 믿지 않는다 */
export async function readRecoveryProof(
  supabase: ClaimsClient,
  nowSec: number = Math.floor(Date.now() / 1000),
): Promise<RecoveryProof> {
  const { data, error } = await supabase.auth.getClaims();
  const claims = (data as { claims?: Claims } | null)?.claims;
  if (error || !claims?.sub) return { status: 'none' };
  if (!claims.email || !hasRecoveryAmr(claims, nowSec))
    return { status: 'denied', userId: claims.sub };
  return { status: 'ok', userId: claims.sub, email: claims.email };
}

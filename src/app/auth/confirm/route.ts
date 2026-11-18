// src/app/auth/confirm/route.ts (A · REQ-005) — 재설정 링크 확인 (GET 만, 1회용 토큰 — 헌법 9.5, 03 문서 3.2)
import type { NextRequest } from 'next/server';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { routes, safeNext } from '@/shared/contracts/routes';
import { logger, newRef } from '@/shared/lib/logger';
import { redirectPath } from '@/shared/lib/redirect';

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const next = safeNext(url.searchParams.get('next'), routes.resetPassword());
  const invalid = `${routes.resetPassword()}?error=invalid`;

  if (!tokenHash || type !== 'recovery') return redirectPath(invalid, 303);

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
  if (error) {
    logger.info('auth.confirm.invalid', {
      ref: newRef(),
      code: error.code,
      route: '/auth/confirm',
    });
    return redirectPath(invalid, 303);
  }
  const res = redirectPath(next, 303);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

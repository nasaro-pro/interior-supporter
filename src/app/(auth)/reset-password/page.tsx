// src/app/(auth)/reset-password/page.tsx (A · REQ-005·SEC-02) — AUTH-04 비밀번호 재설정 (관리자가 만든 1회용 링크 → /auth/confirm → 여기)
import { getTranslations } from 'next-intl/server';
import { ButtonLink } from '@/shared/ui/button-link';
import { ResetPasswordForm } from '@/features/core/components/auth-forms';
import { readRecoveryProof } from '@/features/core/server/recovery-proof';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { routes } from '@/shared/contracts/routes';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const t = await getTranslations('auth');
  // SEC-02: 로그인 세션만으로는 폼을 보이지 않는다 — 재설정 링크로 10분 안에 만든 세션만 (resetPassword 와 같은 판정)
  const proof = await readRecoveryProof(await createServerSupabase());
  const invalid = sp.error === 'invalid' || proof.status !== 'ok';
  return (
    <main
      data-screen-id="AUTH-04"
      className="bg-card flex flex-col gap-5 rounded-lg border p-6 shadow-sm"
    >
      <h1 className="text-3xl font-semibold tracking-tight">{t('screen.reset')}</h1>
      {invalid ? (
        <>
          <p
            role="alert"
            className="bg-tone-critical-bg text-tone-critical-fg rounded-md px-3 py-2 text-sm"
          >
            {t('reset.linkInvalid')}
          </p>
          <ButtonLink href={routes.login()} data-ui-key="reset-login-link" variant="outline">
            {t('screen.login')}
          </ButtonLink>
        </>
      ) : (
        <>
          <p className="text-muted-foreground">{t('reset.intro')}</p>
          <ResetPasswordForm />
        </>
      )}
    </main>
  );
}

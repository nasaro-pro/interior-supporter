// src/app/(auth)/signup/page.tsx (A · REQ-001) — AUTH-02 업체 셀프 가입
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SignupForm } from '@/features/core/components/auth-forms';
import { routes } from '@/shared/contracts/routes';

export default async function SignupPage() {
  const t = await getTranslations('auth');
  return (
    <main
      data-screen-id="AUTH-02"
      className="bg-card flex flex-col gap-6 rounded-lg border p-6 shadow-sm"
    >
      <h1 className="text-3xl font-semibold tracking-tight">{t('screen.signup')}</h1>
      <SignupForm />
      <p className="text-muted-foreground text-meta">
        <Link
          href={routes.login()}
          className="text-primary underline-offset-4 hover:underline"
          data-ui-key="signup-login-link"
        >
          {t('screen.login')}
        </Link>
      </p>
    </main>
  );
}

// src/app/(auth)/login/page.tsx (A · REQ-002) — AUTH-01 로그인
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from '@/features/core/components/auth-forms';
import { routes, safeNext } from '@/shared/contracts/routes';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; loggedOut?: string; reset?: string }>;
}) {
  const sp = await searchParams;
  const t = await getTranslations('auth');
  const next = sp.next ? safeNext(sp.next, '') : '';
  return (
    <main
      data-screen-id="AUTH-01"
      className="bg-card flex flex-col gap-6 rounded-lg border p-6 shadow-sm"
    >
      <h1 className="text-3xl font-semibold tracking-tight">{t('screen.login')}</h1>
      {sp.loggedOut ? (
        <p
          role="status"
          className="bg-tone-brand-bg text-tone-brand-fg rounded-md px-3 py-2 text-sm"
        >
          {t('login.loggedOut')}
        </p>
      ) : null}
      {sp.reset ? (
        <p
          role="status"
          className="bg-tone-brand-bg text-tone-brand-fg rounded-md px-3 py-2 text-sm"
        >
          {t('reset.done')}
        </p>
      ) : null}
      <LoginForm next={next || undefined} />
      <div className="text-muted-foreground text-meta flex flex-col gap-1">
        <p>{t('login.forgotHint')}</p>
        <p>
          {t('login.noAccountHint')}{' '}
          <Link
            href={routes.signup()}
            className="text-primary underline-offset-4 hover:underline"
            data-ui-key="login-signup-link"
          >
            {t('screen.signup')}
          </Link>
        </p>
      </div>
    </main>
  );
}

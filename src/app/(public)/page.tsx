// src/app/(public)/page.tsx (A · REQ-009) — PUB-01 공개 랜딩. DB 조회 없음
import { FolderKanban, MessagesSquare, Camera, ShieldCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { ButtonLink } from '@/shared/ui/button-link';
import { routes } from '@/shared/contracts/routes';

export default async function LandingPage() {
  const t = await getTranslations('common');
  const features = [
    { icon: FolderKanban, key: 'one' },
    { icon: MessagesSquare, key: 'two' },
    { icon: Camera, key: 'three' },
    { icon: ShieldCheck, key: 'four' },
  ] as const;
  return (
    <main data-screen-id="PUB-01" className="flex min-h-dvh flex-col">
      <header className="page-container flex h-14 items-center justify-between">
        <span className="flex items-center gap-2 font-semibold">
          <span
            aria-hidden
            className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md text-xs"
          >
            IS
          </span>
          {t('appName')}
        </span>
        <ButtonLink
          href={routes.login()}
          data-ui-key="landing-login-link"
          variant="ghost"
          size="sm"
        >
          {t('landing.ctaLogin')}
        </ButtonLink>
      </header>
      <section className="page-container flex flex-1 flex-col justify-center gap-8 py-16">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t('landing.headline')}</h1>
          <p className="text-muted-foreground mt-4 text-base">{t('landing.subline')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={routes.signup()} data-ui-key="landing-signup-link" size="lg">
              {t('landing.ctaSignup')}
            </ButtonLink>
            <ButtonLink
              href={routes.login()}
              data-ui-key="landing-login-cta"
              size="lg"
              variant="outline"
            >
              {t('landing.ctaLogin')}
            </ButtonLink>
          </div>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, key }) => (
            <li key={key} className="bg-card rounded-lg border p-4 shadow-sm">
              <Icon aria-hidden className="text-primary size-5" />
              <p className="mt-3 font-medium">{t(`landing.feature.${key}.title`)}</p>
              <p className="text-muted-foreground text-meta mt-1">
                {t(`landing.feature.${key}.body`)}
              </p>
            </li>
          ))}
        </ul>
      </section>
      <footer className="page-container text-muted-foreground text-meta border-t py-6">
        {t('landing.footer')}
      </footer>
    </main>
  );
}

// src/features/core/components/dashboard/dashboard-header.tsx (A · PM-00) — 제목 · 새 프로젝트 · 분류 탭 (밑줄 탭, 휴대폰은 가로로 밀기)
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { withQuery } from '@/features/core/url';
import { DASHBOARD_TABS, type DashboardTab } from '@/features/core/server/dashboard-queries';
import { routes } from '@/shared/contracts/routes';
import { cn } from '@/shared/lib/utils';
import { ButtonLink } from '@/shared/ui/button-link';

export function DashboardHeader({
  slug,
  tab,
  count,
  canCreate,
}: {
  slug: string;
  tab: DashboardTab;
  count: Record<DashboardTab, number | null>;
  canCreate: boolean;
}) {
  const t = useTranslations('projects.dashboard');
  const tn = useTranslations('common.nav');
  const home = routes.app.home(slug);
  const tabHref = (k: DashboardTab) => (k === 'all' ? home : withQuery(home, { tab: k }));
  return (
    <div className="flex flex-col gap-4 border-b">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{t('title')}</h1>
        {canCreate ? (
          <ButtonLink
            href={withQuery(routes.app.projects(slug), { mode: 'new' })}
            data-ui-key="dashboard-new-project"
          >
            <Plus aria-hidden />
            {tn('newProject')}
          </ButtonLink>
        ) : null}
      </div>
      <nav aria-label={t('tabsLabel')} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex min-w-max gap-5 md:gap-6">
          {DASHBOARD_TABS.map((k) => {
            const active = k === tab;
            return (
              <li key={k}>
                <Link
                  href={tabHref(k)}
                  aria-current={active ? 'page' : undefined}
                  data-ui-key={`dashboard-tab-${k}`}
                  className={cn(
                    '-mb-px inline-flex items-center gap-1.5 border-b-2 pb-3 text-sm',
                    active
                      ? 'border-foreground text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground border-transparent',
                  )}
                >
                  {t(`tab.${k}`)}
                  {count[k] ? (
                    <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[11px] leading-5 font-normal tabular-nums">
                      {count[k]}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

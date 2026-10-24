// src/app/app/[company]/settings/page.tsx (A) — PM-60 설정 루트: 각 분류(D2) 목록
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { requireCompanyStaff } from '@/features/core';
import { routes } from '@/shared/contracts/routes';

const SECTIONS = ['company', 'members', 'templates', 'storage'] as const;

export default async function SettingsRootPage({
  params,
}: {
  params: Promise<{ company: string }>;
}) {
  const { company } = await params;
  const staff = await requireCompanyStaff(company);
  const slug = decodeURIComponent(company);
  const t = await getTranslations('settings');
  const manager = staff.role === 'owner' || staff.role === 'manager';
  return (
    <main data-screen-id="PM-60" className="flex flex-col gap-3">
      {!manager ? (
        <p role="status" className="bg-tone-caution-bg text-tone-caution-fg rounded-md px-3 py-2">
          {t('state.managerOnly')}
        </p>
      ) : null}
      <ul className="bg-card divide-y rounded-lg border">
        {SECTIONS.map((s) => (
          <li key={s}>
            <Link
              href={routes.app.settings(slug, s)}
              className="hover:bg-accent/60 flex items-center justify-between px-4 py-3"
              data-ui-key="settings-section-open"
              data-key={s}
            >
              <span className="font-medium">{t(`screen.${s}`)}</span>
              <ChevronRight aria-hidden className="text-muted-foreground size-4" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

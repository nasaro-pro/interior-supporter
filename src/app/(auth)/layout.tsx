// src/app/(auth)/layout.tsx (A) — 인증 화면 공통 틀 (공통 진입 절차, 메뉴의 부모 아님)
import type { ReactNode } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { routes } from '@/shared/contracts/routes';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('common');
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10">
      <Link
        href={routes.landing()}
        className="mb-8 flex items-center gap-2 font-semibold"
        data-ui-key="auth-home-link"
      >
        <span
          aria-hidden
          className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md text-xs"
        >
          IS
        </span>
        {t('appName')}
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

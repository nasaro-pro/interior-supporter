// src/app/(auth)/admin/login/page.tsx — ADM-00 사이트 관리 로그인 (A1). 일반 로그인 폼을 쓰고 끝나면 /admin 으로
// 관리자 여부는 /admin 레이아웃이 다시 확인한다 (관리자가 아니면 404). 로그인 시도 제한은 로그인 액션이 이미 한다
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from '@/features/core/components/auth-forms';
import { routes } from '@/shared/contracts/routes';

export default async function AdminLoginPage() {
  const t = await getTranslations('admin');
  return (
    <main
      data-screen-id="ADM-00"
      className="bg-card flex flex-col gap-6 rounded-lg border p-6 shadow-sm"
    >
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t('screen.login')}</h1>
        <p className="text-muted-foreground mt-2">{t('login.description')}</p>
      </div>
      <LoginForm next={routes.admin.dashboard()} />
      <Link
        href={routes.login()}
        className="text-meta text-muted-foreground underline-offset-4 hover:underline"
      >
        {t('login.normalLogin')}
      </Link>
    </main>
  );
}

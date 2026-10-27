// src/app/account/withdraw/page.tsx — ACC-01 본인 탈퇴 (A10). 로그인한 누구나
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { WithdrawForm } from '@/features/admin/components/WithdrawForm';
import { getSessionUserId } from '@/features/core/server/access';
import { routes } from '@/shared/contracts/routes';

export default async function WithdrawPage() {
  if (!(await getSessionUserId())) redirect(routes.login(routes.withdraw()));
  const t = await getTranslations('admin');
  return (
    <main data-screen-id="ACC-01" className="page-container flex max-w-xl flex-col gap-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{t('screen.withdraw')}</h1>
      <p>{t('withdraw.description')}</p>
      <p className="text-muted-foreground text-meta">{t('withdraw.soleOwnerHint')}</p>
      <WithdrawForm />
    </main>
  );
}

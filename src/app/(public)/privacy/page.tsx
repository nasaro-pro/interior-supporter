// src/app/(public)/privacy/page.tsx — PUB-03 개인정보처리방침 (A9). 로그인 없이 읽는다
import { getTranslations } from 'next-intl/server';
import { LegalDocument } from '@/features/admin';

export default async function PrivacyPage() {
  const t = await getTranslations('admin');
  return (
    <main data-screen-id="PUB-03" className="page-container flex max-w-3xl flex-col gap-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{t('screen.privacy')}</h1>
      <LegalDocument kind="privacy" />
    </main>
  );
}

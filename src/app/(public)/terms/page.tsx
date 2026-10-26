// src/app/(public)/terms/page.tsx — PUB-02 이용약관 (A9). 로그인 없이 읽는다
import { getTranslations } from 'next-intl/server';
import { LegalDocument } from '@/features/admin';

export default async function TermsPage() {
  const t = await getTranslations('admin');
  return (
    <main data-screen-id="PUB-02" className="page-container flex max-w-3xl flex-col gap-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{t('screen.terms')}</h1>
      <LegalDocument kind="terms" />
    </main>
  );
}

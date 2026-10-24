// src/app/layout.tsx (A · 스타터 기준) — 루트 레이아웃. B·C 는 수정하지 않는다.
// A 는 TASK-001 에서 Pretendard(next/font/local)를 추가한다. 그 외 구조 변경은 CR.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import localFont from 'next/font/local';
import { Toaster } from 'sonner';
import './globals.css';

// TASK-001: Pretendard Variable (OFL 1.1, public/fonts/Pretendard-LICENSE.txt) — 02 문서 7.3
const pretendard = localFont({
  src: '../../public/fonts/PretendardVariable.woff2',
  variable: '--font-pretendard',
  weight: '45 920',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common');
  return { title: { default: t('appName'), template: `%s · ${t('appName')}` } };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={pretendard.variable}>
      <body>
        <NextIntlClientProvider>
          {children}
          <Toaster position="top-center" closeButton richColors />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

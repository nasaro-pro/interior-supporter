// next.config.ts (A · 스타터 고정) — 00 헌법 5장. 옵션 추가는 CR.
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['sharp'],
};

export default withNextIntl(nextConfig);

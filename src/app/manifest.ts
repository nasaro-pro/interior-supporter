// src/app/manifest.ts (A · D-18) — 홈 화면에 추가(PWA): 휴대폰에서 앱처럼 열리게 한다.
// 로그인 유지는 Supabase 세션 쿠키가 자동 갱신으로 이어 준다 (로그아웃 전까지 유지)
import type { MetadataRoute } from 'next';
import { routes } from '@/shared/contracts/routes';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: process.env.NEXT_PUBLIC_APP_NAME ?? '인테리어 서포터',
    short_name: process.env.NEXT_PUBLIC_APP_NAME ?? '인테리어 서포터',
    start_url: routes.selectArea(),
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0f766e',
    lang: 'ko',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

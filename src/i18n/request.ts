// src/i18n/request.ts (A · 스타터 고정) — next-intl 4, URL 접두어 없음, 쿠키 NEXT_LOCALE (ADR-006, REQ-008)
// 로그인 사용자의 profiles.locale 동기화는 A 의 TASK-001 이 이 파일 밖(언어 전환 액션)에서 쿠키를 맞추는 방식으로 한다.
import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

export const LOCALES = ['ko', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ko';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/** messages/<locale>/<ns>.json — 새 ns 추가는 CR (00 헌법 10.4) */
export const NAMESPACES = [
  'common',
  'auth',
  'errors',
  'projects',
  'clients',
  'history',
  'notifications',
  'settings',
  'files',
  'designs',
  'materials',
  'estimates',
  'requests',
  'photos',
  'schedule',
  'admin', // 2차 수정 CR-3 사이트 관리·약관·탈퇴
] as const;

export function toLocale(value: string | undefined): Locale {
  return value === 'en' ? 'en' : DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = toLocale(store.get(LOCALE_COOKIE)?.value);
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => {
      const mod = (await import(`../../messages/${locale}/${ns}.json`)) as {
        default: Record<string, unknown>;
      };
      return [ns, mod.default] as const;
    }),
  );
  return { locale, messages: Object.fromEntries(entries), timeZone: 'Asia/Seoul' };
});

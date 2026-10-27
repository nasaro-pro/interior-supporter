// src/features/core/home-theme.ts (A · REQ-052, CR-A-10) — 고객 홈 테마 = 디자인 토큰 tone-* 키 (DB CHECK valid_home_theme)
export const HOME_THEMES = [
  'brand',
  'info',
  'positive',
  'caution',
  'attention',
  'neutral',
] as const;
export type HomeTheme = (typeof HOME_THEMES)[number];
export const DEFAULT_HOME_THEME: HomeTheme = 'brand';

/** Tailwind 가 정적으로 찾을 수 있도록 클래스 전체 문자열로 둔다 */
export const HOME_THEME_CLASS: Record<HomeTheme, string> = {
  brand: 'bg-tone-brand-bg text-tone-brand-fg',
  info: 'bg-tone-info-bg text-tone-info-fg',
  positive: 'bg-tone-positive-bg text-tone-positive-fg',
  caution: 'bg-tone-caution-bg text-tone-caution-fg',
  attention: 'bg-tone-attention-bg text-tone-attention-fg',
  neutral: 'bg-tone-neutral-bg text-tone-neutral-fg',
};

export function normalizeHomeTheme(raw: unknown): HomeTheme {
  return typeof raw === 'string' && (HOME_THEMES as readonly string[]).includes(raw)
    ? (raw as HomeTheme)
    : DEFAULT_HOME_THEME;
}

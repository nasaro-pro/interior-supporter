// src/features/core/page-theme.ts (A · REQ-052, CR-A-10) — 고객 페이지 분위기(배경색) 프리셋 · 페이지별 이미지 (DB CHECK valid_page_tone · valid_page_images)
import { PORTAL_TABS, type PortalTab } from '@/shared/contracts/screens';

export const PAGE_TONES = ['default', 'ivory', 'sand', 'greige', 'sage', 'mist', 'clay'] as const;
export type PageTone = (typeof PAGE_TONES)[number];
export const DEFAULT_PAGE_TONE: PageTone = 'default';

/** 탭 키 → files.id (company_logo kind). 없는 탭은 이미지 없음 */
export type PageImages = Partial<Record<PortalTab, string>>;

/**
 * 분위기별 바탕(canvas)·시트(surface) 색. 웜 뉴트럴 중심, 다크 모드는 같은 색조의 어두운 값.
 * globals.css 는 고정 파일이라 프리셋 토큰을 여기 한 곳에 둔다 (CR-A-10 결정 필요 ③).
 * Tailwind 가 정적으로 찾을 수 있도록 클래스 전체 문자열로 둔다.
 */
export const PAGE_TONE_CLASS: Record<PageTone, string> = {
  default: '[--page-canvas:var(--background)] [--page-surface:var(--background)]',
  ivory:
    '[--page-canvas:#f4eee3] [--page-surface:#fbf8f2] dark:[--page-canvas:#1c1915] dark:[--page-surface:#24201b]',
  sand: '[--page-canvas:#e9dcc8] [--page-surface:#f7f1e7] dark:[--page-canvas:#221c14] dark:[--page-surface:#2b241b]',
  greige:
    '[--page-canvas:#e3ded6] [--page-surface:#f4f1ec] dark:[--page-canvas:#1e1c19] dark:[--page-surface:#272421]',
  sage: '[--page-canvas:#dde4d8] [--page-surface:#f1f4ee] dark:[--page-canvas:#171c18] dark:[--page-surface:#1f2620]',
  mist: '[--page-canvas:#dce3ea] [--page-surface:#f0f3f6] dark:[--page-canvas:#161b20] dark:[--page-surface:#1e242b]',
  clay: '[--page-canvas:#ecd9cb] [--page-surface:#f8efe8] dark:[--page-canvas:#241912] dark:[--page-surface:#2d211a]',
};

/** 설정 화면 견본 (bg 만 — 텍스트 색은 토큰 그대로) */
export const PAGE_TONE_SWATCH: Record<PageTone, string> = {
  default: 'bg-background',
  ivory: 'bg-[#f4eee3] dark:bg-[#1c1915]',
  sand: 'bg-[#e9dcc8] dark:bg-[#221c14]',
  greige: 'bg-[#e3ded6] dark:bg-[#1e1c19]',
  sage: 'bg-[#dde4d8] dark:bg-[#171c18]',
  mist: 'bg-[#dce3ea] dark:bg-[#161b20]',
  clay: 'bg-[#ecd9cb] dark:bg-[#241912]',
};

export function normalizePageTone(raw: unknown): PageTone {
  return typeof raw === 'string' && (PAGE_TONES as readonly string[]).includes(raw)
    ? (raw as PageTone)
    : DEFAULT_PAGE_TONE;
}

/** DB jsonb → 알려진 탭 키 + 문자열 값만 */
export function normalizePageImages(raw: unknown): PageImages {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: PageImages = {};
  for (const tab of PORTAL_TABS) {
    const v = (raw as Record<string, unknown>)[tab];
    if (typeof v === 'string' && v) out[tab] = v;
  }
  return out;
}

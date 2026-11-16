// src/features/core/customer-style.ts (A · REQ-014) — 고객 화면 제목 글꼴·굵기 (DB CHECK projects_title_font_valid · projects_title_weight_valid)
// 공개 홈페이지(portfolio brand.ts)와 같은 선택지 중 고객 화면에 맞는 것만: 노토 산스 · 노토 세리프, 400 · 500 · 600
import type { CSSProperties } from 'react';

export const CUSTOMER_TITLE_FONTS = ['noto_sans', 'noto_serif'] as const;
export type CustomerTitleFont = (typeof CUSTOMER_TITLE_FONTS)[number];
export const CUSTOMER_TITLE_WEIGHTS = [400, 500, 600] as const;
export type CustomerTitleWeight = (typeof CUSTOMER_TITLE_WEIGHTS)[number];

export const DEFAULT_CUSTOMER_TITLE_FONT: CustomerTitleFont = 'noto_sans';
export const DEFAULT_CUSTOMER_TITLE_WEIGHT: CustomerTitleWeight = 600;

export function normalizeTitleFont(raw: unknown): CustomerTitleFont {
  return typeof raw === 'string' && (CUSTOMER_TITLE_FONTS as readonly string[]).includes(raw)
    ? (raw as CustomerTitleFont)
    : DEFAULT_CUSTOMER_TITLE_FONT;
}

export function normalizeTitleWeight(raw: unknown): CustomerTitleWeight {
  const n = Number(raw);
  return (CUSTOMER_TITLE_WEIGHTS as readonly number[]).includes(n)
    ? (n as CustomerTitleWeight)
    : DEFAULT_CUSTOMER_TITLE_WEIGHT;
}

/**
 * 고객 화면 틀에 거는 변수 — 제목(.customer-title)이 읽는다.
 * 명조는 portfolio/font.ts 의 --font-brand-serif (틀에 brandFontClass 를 같이 건다)
 */
export function customerTitleVars(font: CustomerTitleFont, weight: CustomerTitleWeight) {
  return {
    '--customer-title-font':
      font === 'noto_serif' ? "var(--font-brand-serif), 'Noto Serif KR', serif" : 'inherit',
    '--customer-title-weight': String(weight),
  } as CSSProperties;
}

/** 제목에 붙이는 클래스 (Tailwind 가 정적으로 찾도록 전체 문자열) */
export const CUSTOMER_TITLE_CLASS =
  '[font-family:var(--customer-title-font,inherit)] [font-weight:var(--customer-title-weight,600)]';

// 공개 포트폴리오 = v3/Stitch "브랜드 화면" 시스템 (종이색·먹색·이름과 숫자는 세리프, 강조색 없음)
// 앱 전체 토큰(globals.css, 고정 파일)은 건드리지 않고, 공개 페이지 바깥 div 에만 CSS 변수를 덮어쓴다.
// → bg-background·text-muted-foreground 같은 기존 토큰 클래스가 이 안에서는 브랜드 색으로 바뀐다.
// 분위기(page_tone)는 page-theme.ts 의 7종과 같은 값. 바탕(canvas)과 카드(surface)만 바뀐다.
import type { CSSProperties } from 'react';
import { PAGE_TONES } from '@/features/core/page-theme';

/**
 * 포트폴리오 분위기 = 공용 7가지(고객 홈 템플릿과 같은 목록) + 포트폴리오에만 있는 '종이색'(paper).
 *  default: 기본 = 화이트 (공용 '기본'이 앱 바탕색인 것과 같은 뜻)
 *  paper  : 종이색 #F5F1E9 (예전 포트폴리오 '기본' = Stitch 종이색)
 * DB: company_portfolios.page_tone CHECK (20261108000800). 공용 목록·고객 홈은 그대로.
 */
export const PORTFOLIO_TONES = [
  'default',
  'paper',
  ...PAGE_TONES.filter((t) => t !== 'default'),
] as const;
export type PortfolioTone = 'default' | 'paper' | Exclude<(typeof PAGE_TONES)[number], 'default'>;
export const normalizePortfolioTone = (v: unknown): PortfolioTone =>
  typeof v === 'string' && (PORTFOLIO_TONES as readonly string[]).includes(v)
    ? (v as PortfolioTone)
    : 'default';

/** 분위기별 [바탕, 시트] — ivory~clay 는 page-theme.ts PAGE_TONE_CLASS 와 같은 값. default = 화이트, paper = 종이색 */
export const TONE_HEX: Record<PortfolioTone, { canvas: string; surface: string }> = {
  default: { canvas: '#FFFFFF', surface: '#F7F6F3' }, // 화이트 — 시트는 아주 연한 웜그레이로 칸 구분
  paper: { canvas: '#F5F1E9', surface: '#FBF8F2' },
  ivory: { canvas: '#F4EEE3', surface: '#FBF8F2' },
  sand: { canvas: '#E9DCC8', surface: '#F7F1E7' },
  greige: { canvas: '#E3DED6', surface: '#F4F1EC' },
  sage: { canvas: '#DDE4D8', surface: '#F1F4EE' },
  mist: { canvas: '#DCE3EA', surface: '#F0F3F6' },
  clay: { canvas: '#ECD9CB', surface: '#F8EFE8' },
};

/**
 * 브랜드 토큰. 보조 글자는 Stitch 값 #6B655C 가 샌드·클레이 바탕에서 4.5:1 미달(4.27·4.22)이라
 * 한 단계 진한 #625C53 을 쓴다 → 7개 분위기 모두 4.84:1 이상 (brand.test.ts 가 계산으로 확인).
 */
export const BRAND = {
  foreground: '#2C2C2C',
  mutedForeground: '#625C53',
  muted: '#EDE7DE',
  border: '#DDD5C8',
  input: '#91897F',
  primary: '#484D49',
  primaryForeground: '#FFFFFF',
  accent: '#E8E1D6',
  card: '#FFFFFF',
} as const;

export function brandStyle(tone: PortfolioTone): CSSProperties {
  const t = TONE_HEX[tone] ?? TONE_HEX.default;
  return {
    colorScheme: 'light', // 브랜드 화면은 밝은 화면만 (다크 값 미정 — 보완점 1-4)
    '--background': t.canvas,
    '--foreground': BRAND.foreground,
    '--card': BRAND.card,
    '--card-foreground': BRAND.foreground,
    '--popover': BRAND.card,
    '--popover-foreground': BRAND.foreground,
    '--muted': BRAND.muted,
    '--muted-foreground': BRAND.mutedForeground,
    '--border': BRAND.border,
    '--input': BRAND.input,
    '--primary': BRAND.primary,
    '--primary-foreground': BRAND.primaryForeground,
    '--ring': BRAND.primary,
    '--secondary': BRAND.muted,
    '--secondary-foreground': BRAND.foreground,
    '--accent': BRAND.accent,
    '--accent-foreground': BRAND.foreground,
    '--brand-surface': t.surface,
    backgroundColor: t.canvas,
    color: BRAND.foreground,
  } as CSSProperties;
}

/** 이름·숫자(제목)에 쓰는 글꼴 — 업체가 고른 제목 글꼴(--pf-title). 없으면 노토 산스 (기본, 20261108001000) */
const titleFamily = 'font-[family-name:var(--pf-title,var(--font-noto-sans))] tracking-[-0.02em]';
export const serif = `${titleFamily} [font-weight:var(--pf-title-weight,600)]`;
/** 사진 위 제목(슬라이드)용 — 가늘게를 골라도 최소 500 (serif 대신 쓴다. 둘을 같이 쓰면 CSS 순서에 따라 덮임) */
export const serifOnPhoto = `${titleFamily} [font-weight:max(500,var(--pf-title-weight,600))]`;

/**
 * 글꼴 (DB title_font / body_font, 20261108000700). PC·휴대폰 같음.
 *  serif     : 노토 세리프 KR (명조) — next/font/google 으로 우리 서버가 내려줌
 *  pretendard: 프리텐다드 — 앱 루트가 이미 불러옴
 *  noto_sans : 노토 산스 KR (제목·본문 기본, 20261108001000) — next/font/google
 *  system    : 기기 고딕 — 윈도우 맑은 고딕 · 맥/아이폰 애플 산돌고딕 · 안드로이드 본고딕 (글꼴 파일을 내려받지 않음)
 *  맑은 고딕은 MS 라이선스상 웹에 올려 배포할 수 없어 '기기 고딕'으로만 쓴다.
 */
export const TITLE_FONTS = ['serif', 'pretendard', 'noto_sans', 'system'] as const;
export const BODY_FONTS = ['pretendard', 'noto_sans', 'system'] as const;
export type TitleFont = (typeof TITLE_FONTS)[number];
export type BodyFont = (typeof BODY_FONTS)[number];
/** 제목 굵기 — 400 가늘게 / 500 보통 / 600 굵게(기본) */
export const TITLE_WEIGHTS = [400, 500, 600] as const;
export type TitleWeight = (typeof TITLE_WEIGHTS)[number];
export const normalizeTitleWeight = (v: unknown): TitleWeight => {
  const n = Number(v);
  return n === 400 || n === 500 ? n : 600;
};

const SYSTEM_GOTHIC =
  '"Malgun Gothic","맑은 고딕","Apple SD Gothic Neo",-apple-system,"Noto Sans KR",sans-serif';
export const FONT_STACK: Record<TitleFont, string> = {
  // var() 에 기본값을 둬서 글꼴 변수가 없는 곳(앱 다른 화면 등)에서도 선언이 깨지지 않게
  serif: 'var(--font-brand-serif,"Noto Serif KR"),serif',
  pretendard: 'var(--font-pretendard,"Pretendard Variable"),"Pretendard",system-ui,sans-serif',
  noto_sans: 'var(--font-noto-sans,"Noto Sans KR"),sans-serif',
  system: SYSTEM_GOTHIC,
};

export const normalizeTitleFont = (v: unknown): TitleFont =>
  (TITLE_FONTS as readonly unknown[]).includes(v) ? (v as TitleFont) : 'noto_sans';
export const normalizeBodyFont = (v: unknown): BodyFont =>
  (BODY_FONTS as readonly unknown[]).includes(v) ? (v as BodyFont) : 'noto_sans';

/** 틀(div)에 넣는 글꼴 변수 — 제목은 serif 클래스가 --pf-title 을, 본문은 font-family 를 그대로 물려받는다 */
export function fontStyle(title: unknown, body: unknown, weight?: unknown): CSSProperties {
  return {
    '--pf-title': FONT_STACK[normalizeTitleFont(title)],
    '--pf-title-weight': String(normalizeTitleWeight(weight)),
    fontFamily: FONT_STACK[normalizeBodyFont(body)],
  } as CSSProperties;
}

/**
 * 바닥 칸 색 — 업체가 고른 분위기(page_tone)를 따라간다. 업체는 3가지 중에서만 고른다 (DB footer_tone)
 *  same: 페이지와 같은 색 + 위 선 / soft: 같은 계열 한 톤 진하게 (기본) / deep: 같은 계열 아주 진하게 + 밝은 글자
 * 21개 조합 모두 글자 4.5:1 이상 (brand.test.ts 가 계산으로 확인)
 */
export const FOOTER_TONES = ['same', 'soft', 'deep'] as const;
export type FooterTone = (typeof FOOTER_TONES)[number];

export const FOOTER_HEX: Record<PortfolioTone, { soft: string; deep: string }> = {
  default: { soft: '#F2F0EC', deep: '#2A2926' },
  paper: { soft: '#EAE4D8', deep: '#2A2926' },
  ivory: { soft: '#E9E0D0', deep: '#2E2A24' },
  sand: { soft: '#DCCBB2', deep: '#3B3328' },
  greige: { soft: '#D6CFC4', deep: '#33312D' },
  sage: { soft: '#CDD7C6', deep: '#2E3830' },
  mist: { soft: '#CBD5DF', deep: '#2B333B' },
  clay: { soft: '#E0C7B5', deep: '#3D2F28' },
};

export function footerColors(tone: PortfolioTone, footer: FooterTone) {
  const t = TONE_HEX[tone] ?? TONE_HEX.default;
  const f = FOOTER_HEX[tone] ?? FOOTER_HEX.default;
  if (footer === 'deep')
    return {
      bg: f.deep,
      fg: '#F2EEE7',
      muted: '#B3ACA2',
      line: 'rgba(255,255,255,.14)',
      topLine: 'transparent',
    };
  if (footer === 'soft')
    return {
      bg: f.soft,
      fg: BRAND.foreground,
      muted: '#524C45',
      line: 'rgba(44,44,44,.14)',
      topLine: 'transparent',
    };
  return {
    bg: t.canvas,
    fg: BRAND.foreground,
    muted: BRAND.mutedForeground,
    line: BRAND.border,
    topLine: BRAND.border,
  };
}

export function normalizeFooterTone(v: unknown): FooterTone {
  return v === 'same' || v === 'deep' ? v : 'soft';
}

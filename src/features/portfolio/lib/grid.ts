// 포트폴리오 공개 화면 순수 로직 (컴포넌트 테스트 대상)
// 목록: 공간 거르기·칩·대표 사례 나누기·한 줄 정보 / 상세: 비포·애프터 짝·공간 탭·사진 넘기기
import type { BodyFont, TitleFont, TitleWeight } from '../brand';
import type { PageLabels } from './labels';
import { PORTFOLIO_SPACES, type PortfolioSpace } from '../schema';

export interface PublicImage {
  path: string;
  thumbPath: string;
  width: number;
  height: number;
  caption: string;
}

/** get_public_portfolio RPC 의 works[] 한 칸 */
export interface PublicWorkCard {
  id: string;
  title: string;
  areaLabel: string;
  sizePyeong: number | null;
  spaces: PortfolioSpace[];
  completedOn: string | null; // YYYY-MM-DD
  durationWeeks: number | null;
  /** 대표 사례 (대표 사진이 있을 때만 true 로 내려온다) */
  isFeatured: boolean;
  cover: PublicImage | null;
}

/** get_public_portfolio_work RPC 의 images[] 한 칸 */
export interface PublicWorkImage extends PublicImage {
  id: string;
  thumbWidth: number;
  thumbHeight: number;
  space: PortfolioSpace | null;
  /** 같은 공간이 여럿일 때 이름 — "침실A" */
  spaceLabel: string;
  role: 'gallery' | 'before' | 'after';
}

/** 공개 페이지가 쓰는 업체 정보 (두 RPC 공통) */
export interface PublicCompany {
  slug: string;
  name: string;
  intro?: string;
  contactPhone: string | null;
  contactUrl: string | null;
  pageTone: string;
  logoPath: string | null;
  businessName: string;
  representative: string;
  businessRegNo: string | null;
  address: string;
  csHours: string;
  /** 대표 사례 수 = 슬라이드 장수 (1~6) */
  featuredLimit: number;
  /** 바닥 칸 (비면 그 줄을 안 보임) */
  contactEmail?: string | null;
  mailOrderNo?: string | null;
  footerSlogan?: string;
  footerTone?: 'same' | 'soft' | 'deep';
  snsLinks?: string[];
  /** 시공 사례 배열 (없으면 갤러리·필터 켬·3장) */
  worksLayout?: WorksLayout;
  galleryFilter?: boolean;
  carouselPer?: 3 | 4;
  /** 글꼴 (없으면 제목 노토 세리프 · 본문 프리텐다드) */
  titleFont?: TitleFont;
  bodyFont?: BodyFont;
  titleWeight?: TitleWeight;
  /** 휴대폰 따로: 배열(null = PC와 같게) · 갤러리 칸 수 */
  mobileWorksLayout?: WorksLayout | null;
  mobileGalleryCols?: 1 | 2;
  /** 홈페이지 이름 (사이트 관리자가 정함). 있으면 name 이 이 값으로 바뀌어 온다 (parse) */
  siteName?: string | null;
  /** 업체가 고친 작은 문구 */
  labels?: PageLabels;
  /** 로고 숨기기 — 로고 칸(첫 글자 포함) 없이 이름만 */
  logoHidden?: boolean;
}

/** 시공 사례 배열 — gallery(C 세로 격자 + 공간 필터) / carousel(D 가로 넘김) */
export const WORKS_LAYOUTS = ['gallery', 'carousel', 'list'] as const;
export type WorksLayout = (typeof WORKS_LAYOUTS)[number];
export const normalizeWorksLayout = (v: unknown): WorksLayout =>
  (WORKS_LAYOUTS as readonly unknown[]).includes(v) ? (v as WorksLayout) : 'gallery';
export const normalizeCarouselPer = (v: unknown): 3 | 4 => (Number(v) === 4 ? 4 : 3);
/** 휴대폰 배열: 비었거나 이상하면 null (= PC와 같게) */
export const normalizeMobileLayout = (v: unknown): WorksLayout | null =>
  (WORKS_LAYOUTS as readonly unknown[]).includes(v) ? (v as WorksLayout) : null;
export const normalizeMobileCols = (v: unknown): 1 | 2 => (Number(v) === 1 ? 1 : 2);

/** 대표 사례 수 — 업체가 1~6 중 정한다 (DB company_portfolios.featured_limit, 기본 3) */
export const FEATURED_LIMIT_DEFAULT = 3;
export const FEATURED_LIMIT_MAX = 6;
export const clampFeaturedLimit = (n: unknown) => {
  if (n === null || n === undefined || n === '') return FEATURED_LIMIT_DEFAULT;
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(FEATURED_LIMIT_MAX, Math.max(1, v)) : FEATURED_LIMIT_DEFAULT;
};

/**
 * 고객에게 보여 주는 공간 순서 — 집을 둘러보는 순서(거실 → 주방 → 침실 → 욕실 → 현관 …).
 * DB enum 순서(욕실이 침실보다 앞)와 다르다. 칩·탭 모두 이 순서.
 */
export const SPACE_DISPLAY_ORDER = [
  'living',
  'kitchen',
  'bedroom',
  'bathroom',
  'entrance',
  'balcony',
  'utility',
  'common',
  'other',
] as const satisfies readonly PortfolioSpace[];

export function isPortfolioSpace(v: unknown): v is PortfolioSpace {
  return typeof v === 'string' && (PORTFOLIO_SPACES as readonly string[]).includes(v);
}

/** ?space= 값 정리 — 모르는 값은 '전체'(null) */
export function parseSpace(raw: string | string[] | undefined): PortfolioSpace | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return isPortfolioSpace(v) ? v : null;
}

export function filterBySpace(works: PublicWorkCard[], space: PortfolioSpace | null) {
  return space ? works.filter((w) => w.spaces.includes(space)) : works;
}

/** 칩에 보여 줄 공간 — 사례가 1개 이상 있는 공간만, SPACE_DISPLAY_ORDER 순서 */
export function spaceCounts(works: PublicWorkCard[]): { space: PortfolioSpace; count: number }[] {
  return SPACE_DISPLAY_ORDER.map((space) => ({
    space,
    count: works.filter((w) => w.spaces.includes(space)).length,
  })).filter((x) => x.count > 0);
}

/**
 * 공개 목록 맨 위 슬라이드 사진 — 업체가 정한 대표 사례 수(limit, 1~6)만큼.
 * 대표 사례(받은 순서)를 먼저, 모자라면 나머지 사례 사진으로 채운다 (사진 없는 사례는 건너뜀).
 * 대표가 limit 보다 많으면(수를 줄였을 때) 앞쪽 limit 개만.
 */
export function slideshowWorks(
  works: PublicWorkCard[],
  limit: number = FEATURED_LIMIT_DEFAULT,
): (PublicWorkCard & { cover: PublicImage })[] {
  const n = clampFeaturedLimit(limit);
  const withCover = works.filter((w): w is PublicWorkCard & { cover: PublicImage } => !!w.cover);
  const featured = withCover.filter((w) => w.isFeatured).slice(0, n);
  const ids = new Set(featured.map((w) => w.id));
  return [...featured, ...withCover.filter((w) => !ids.has(w.id))].slice(0, n);
}

/** 1) "청담동 · 32평 · 9주 · 2026. 11." — 빈 값은 건너뛴다 (평수는 정수면 소수점 없이) */
export function metaLine(
  w: Pick<PublicWorkCard, 'areaLabel' | 'sizePyeong' | 'completedOn' | 'durationWeeks'>,
  label: { pyeong: (n: string) => string; weeks: (n: number) => string },
): string {
  const size =
    w.sizePyeong === null
      ? null
      : label.pyeong(
          Number.isInteger(w.sizePyeong) ? String(w.sizePyeong) : w.sizePyeong.toFixed(1),
        );
  const weeks = w.durationWeeks ? label.weeks(w.durationWeeks) : null;
  const ym = w.completedOn
    ? `${w.completedOn.slice(0, 4)}. ${Number(w.completedOn.slice(5, 7))}.`
    : null;
  return [w.areaLabel || null, size, weeks, ym].filter(Boolean).join(' · ');
}

/** 상세: 비포·애프터가 모두 있을 때만 슬라이더 짝 */
export function beforeAfterPair(images: PublicWorkImage[]) {
  const before = images.find((i) => i.role === 'before');
  const after = images.find((i) => i.role === 'after');
  return before && after ? { before, after } : null;
}

export interface SpaceTab {
  /** 'all' 또는 `${space}:${spaceLabel}` */
  key: string;
  space: PortfolioSpace | null;
  spaceLabel: string;
  items: PublicWorkImage[];
}

/**
 * 2) 공간 탭 — [전체] + 공간·이름별 (거실 / 침실A / 침실B / 욕실A …).
 * 비포 사진은 슬라이더에만 쓰고 탭에는 넣지 않는다. 공간 없는 사진은 맨 뒤 '그 밖의 사진'.
 * 순서: SPACE_DISPLAY_ORDER → 같은 공간 안에서는 이름 가나다순.
 */
export function buildSpaceTabs(images: PublicWorkImage[]): SpaceTab[] {
  const shown = images.filter((i) => i.role !== 'before');
  const tabs: SpaceTab[] = [];
  for (const space of [...SPACE_DISPLAY_ORDER, null] as const) {
    const inSpace = shown.filter((i) => i.space === space);
    const labels = [...new Set(inSpace.map((i) => i.spaceLabel.trim()))].sort((a, b) =>
      a.localeCompare(b, 'ko'),
    );
    for (const spaceLabel of labels) {
      tabs.push({
        key: `${space ?? 'none'}:${spaceLabel}`,
        space,
        spaceLabel,
        items: inSpace.filter((i) => i.spaceLabel.trim() === spaceLabel),
      });
    }
  }
  const all = tabs.flatMap((t) => t.items);
  return all.length ? [{ key: 'all', space: null, spaceLabel: '', items: all }, ...tabs] : [];
}

/** 크게 보기에서 ←→ — 끝에서 처음으로 돈다 */
export function stepIndex(index: number, delta: number, total: number): number {
  if (total <= 0) return 0;
  return (((index + delta) % total) + total) % total;
}

/** 5) 푸터 줄 — 값이 있는 항목만 [이름, 값] */
export function footerRows(c: PublicCompany): [key: string, value: string][] {
  return (
    [
      ['businessName', c.businessName || c.name],
      ['representative', c.representative],
      ['businessRegNo', c.businessRegNo ?? ''],
      ['mailOrderNo', c.mailOrderNo ?? ''],
      ['address', c.address],
    ] as [string, string][]
  ).filter(([, v]) => v.trim() !== '');
}

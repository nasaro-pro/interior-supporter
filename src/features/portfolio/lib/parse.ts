// 공개 RPC(jsonb) → 화면 타입. 모르는 값·깨진 값은 버리거나 기본값으로 (화면이 깨지지 않게)
import { z } from 'zod';
import { PORTFOLIO_SPACES } from '../schema';
import {
  clampFeaturedLimit,
  normalizeCarouselPer,
  normalizeMobileCols,
  normalizeMobileLayout,
  normalizeWorksLayout,
  type PublicCompany,
  type PublicWorkCard,
  type PublicWorkImage,
} from './grid';
import {
  normalizeBodyFont,
  normalizeFooterTone,
  normalizePortfolioTone,
  type PortfolioTone,
  normalizeTitleFont,
  normalizeTitleWeight,
} from '../brand';
import { cleanLabels } from './labels';
import { cleanSnsList } from './sns';

const space = z.enum(PORTFOLIO_SPACES);
const str = z.string().catch('');
const nstr = z.string().nullable().catch(null);
const nnum = z.coerce.number().nullable().catch(null);

const imageBase = z.object({
  path: z.string(),
  thumbPath: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  caption: str,
});

const companySchema = z.object({
  slug: z.string(),
  name: z.string(),
  intro: str.optional(),
  contactPhone: nstr,
  contactUrl: nstr,
  pageTone: z.string().catch('default'),
  logoPath: nstr,
  businessName: str,
  representative: str,
  businessRegNo: nstr,
  address: str,
  csHours: str,
  featuredLimit: z
    .unknown()
    .optional()
    .transform((v) => clampFeaturedLimit(v)), // 없거나 이상하면 3, 범위 밖은 1~6 으로
  // 바닥 칸 (없으면 빈 값 — 예전 RPC 와도 호환)
  contactEmail: nstr.optional().catch(null),
  mailOrderNo: nstr.optional().catch(null),
  footerSlogan: str.optional().catch(''),
  footerTone: z
    .unknown()
    .optional()
    .transform((v) => normalizeFooterTone(v)),
  snsLinks: z
    .unknown()
    .optional()
    .transform((v) =>
      cleanSnsList(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []),
    ),
  worksLayout: z
    .unknown()
    .optional()
    .transform((v) => normalizeWorksLayout(v)),
  galleryFilter: z
    .unknown()
    .optional()
    .transform((v) => v !== false),
  carouselPer: z
    .unknown()
    .optional()
    .transform((v) => normalizeCarouselPer(v)),
  titleFont: z
    .unknown()
    .optional()
    .transform((v) => normalizeTitleFont(v)),
  bodyFont: z
    .unknown()
    .optional()
    .transform((v) => normalizeBodyFont(v)),
  titleWeight: z
    .unknown()
    .optional()
    .transform((v) => normalizeTitleWeight(v)),
  mobileWorksLayout: z
    .unknown()
    .optional()
    .transform((v) => normalizeMobileLayout(v)),
  mobileGalleryCols: z
    .unknown()
    .optional()
    .transform((v) => normalizeMobileCols(v)),
  siteName: nstr.optional().catch(null),
  labels: z
    .unknown()
    .optional()
    .transform((v) => cleanLabels(v)),
  logoHidden: z
    .unknown()
    .optional()
    .transform((v) => v === true),
});

const workCardSchema = z.object({
  id: z.guid(), // guid: 시드 데이터처럼 버전 비트가 없는 id 도 받는다 (DB uuid 형식과 같은 기준)
  title: z.string(),
  areaLabel: str,
  sizePyeong: nnum,
  spaces: z.array(z.string()).catch([]),
  completedOn: nstr,
  durationWeeks: nnum,
  isFeatured: z.boolean().catch(false),
  cover: imageBase.nullable().catch(null),
});

const workImageSchema = imageBase.extend({
  id: z.guid(), // guid: 시드 데이터처럼 버전 비트가 없는 id 도 받는다 (DB uuid 형식과 같은 기준)
  thumbWidth: z.number().int().positive(),
  thumbHeight: z.number().int().positive(),
  space: space.nullable().catch(null),
  spaceLabel: str,
  role: z.enum(['gallery', 'before', 'after']).catch('gallery'),
});

const onlySpaces = (xs: string[]) =>
  xs.filter((x): x is PublicWorkCard['spaces'][number] => space.safeParse(x).success);

export type PortfolioCompany = PublicCompany & { intro: string; pageTone: PortfolioTone };

function toCompany(raw: unknown): PortfolioCompany | null {
  const c = companySchema.safeParse(raw);
  if (!c.success) return null;
  // 홈페이지 이름이 있으면 큰 제목·왼쪽 위·페이지 제목 모두 그 이름 (업체 이름은 회사 정보 그대로)
  const siteName = c.data.siteName?.trim() || null;
  return {
    ...c.data,
    name: siteName ?? c.data.name,
    siteName,
    intro: c.data.intro ?? '',
    pageTone: normalizePortfolioTone(c.data.pageTone),
  };
}

function toCards(raw: unknown): PublicWorkCard[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((w) => {
    const p = workCardSchema.safeParse(w);
    return p.success ? [{ ...p.data, spaces: onlySpaces(p.data.spaces) }] : [];
  });
}

/** get_public_portfolio(slug) 결과 */
export function parsePortfolio(
  raw: unknown,
): { company: PortfolioCompany; works: PublicWorkCard[] } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { company?: unknown; works?: unknown };
  const company = toCompany(r.company);
  return company ? { company, works: toCards(r.works) } : null;
}

export interface PublicWorkDetail extends Omit<PublicWorkCard, 'cover' | 'isFeatured'> {
  summary: string;
  images: PublicWorkImage[];
  company: PortfolioCompany;
}

/** get_public_portfolio_work(slug, id) 결과 */
export function parseWork(raw: unknown): PublicWorkDetail | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const company = toCompany(r.company);
  const head = workCardSchema.omit({ cover: true, isFeatured: true }).safeParse(r);
  if (!company || !head.success) return null;
  const images = Array.isArray(r.images)
    ? r.images.flatMap((i) => {
        const p = workImageSchema.safeParse(i);
        return p.success ? [p.data] : [];
      })
    : [];
  return {
    ...head.data,
    spaces: onlySpaces(head.data.spaces),
    summary: typeof r.summary === 'string' ? r.summary : '',
    images,
    company,
  };
}

/** 공유 미리보기(Open Graph) 대표 사진 — 대표 사례 → 첫 사례 순 */
export function shareCover(works: PublicWorkCard[]) {
  return (works.find((w) => w.isFeatured && w.cover) ?? works.find((w) => w.cover))?.cover ?? null;
}

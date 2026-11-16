// 포트폴리오 입력 검증 (서버 zod) — 오류 메시지는 errors.json 의 field.* 키
import { z } from 'zod';
import { BODY_FONTS, FOOTER_TONES, PORTFOLIO_TONES, TITLE_FONTS } from './brand';
import { canHide, cleanLabels, LABEL_KEYS, LABEL_MAX, type LabelKey } from './lib/labels';
import { checkSns, cleanSnsList, SNS_MAX } from './lib/sns';

export const PORTFOLIO_SPACES = [
  'living',
  'kitchen',
  'bathroom',
  'bedroom',
  'entrance',
  'balcony',
  'utility',
  'common',
  'other',
] as const; // DB enum material_space 와 같은 값
export type PortfolioSpace = (typeof PORTFOLIO_SPACES)[number];

const uuid = z.uuid();
const version = z.coerce.number().int().positive();

/** "청담동"·"분당구 정자동" 까지만. 번지·호수(숫자+호/번지/-)는 거절 (DB check 와 같은 기준) */
export const areaLabelSchema = z
  .string()
  .trim()
  .max(30, { message: 'field.tooLong' })
  .refine((v) => !/[0-9]+\s*(호|번지|-)/.test(v), { message: 'field.areaTooDetailed' });

export const workFieldsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: 'field.required' })
    .max(80, { message: 'field.tooLong' }),
  areaLabel: areaLabelSchema,
  sizePyeong: z.coerce.number().positive().max(9999).nullable(),
  spaces: z.array(z.enum(PORTFOLIO_SPACES)).max(PORTFOLIO_SPACES.length),
  completedOn: z.iso.date().nullable(),
  /** 공사 기간(주). 비우면 원본 프로젝트 기간으로 자동 계산 (createWork) */
  durationWeeks: z.coerce.number().int().min(1).max(104).nullable(),
  summary: z.string().trim().max(1000, { message: 'field.tooLong' }),
});

export const createWorkSchema = workFieldsSchema.extend({
  id: uuid, // POL-038 생성은 클라이언트 UUID
  companyId: uuid,
  projectId: uuid.nullable(),
});

export const updateWorkSchema = workFieldsSchema.partial().extend({
  companyId: uuid,
  workId: uuid,
  baseVersion: version,
  coverImageId: uuid.nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  /** 대표 사례 (업체당 최대 3) */
  isFeatured: z.boolean().optional(),
});

export const consentSchema = z.object({
  companyId: uuid,
  workId: uuid,
  baseVersion: version,
  /** 동의를 받은 방법 (예: "카카오톡 메시지 10/30") */
  note: z
    .string()
    .trim()
    .min(1, { message: 'field.required' })
    .max(200, { message: 'field.tooLong' }),
  /** 화면의 "고객에게 동의를 받았습니다" 체크 — true 여야 기록 */
  confirmed: z.literal(true, { message: 'field.consentRequired' }),
});

export const workStatusSchema = z.object({
  companyId: uuid,
  workId: uuid,
  baseVersion: version,
  status: z.enum(['draft', 'published']),
});

export const companyRefSchema = z.object({ companyId: uuid });
export const workRefSchema = z.object({ companyId: uuid, workId: uuid, baseVersion: version });

export const addImagesSchema = z.object({
  companyId: uuid,
  workId: uuid,
  items: z
    .array(
      z.object({
        sourceFileId: uuid,
        space: z.enum(PORTFOLIO_SPACES).nullable(),
        /** 같은 공간이 여럿일 때 구분 이름 — "침실A", "욕실B" */
        spaceLabel: z.string().trim().max(20, { message: 'field.tooLong' }).default(''),
        role: z.enum(['gallery', 'before', 'after']).default('gallery'),
        caption: z.string().trim().max(120, { message: 'field.tooLong' }).default(''),
      }),
    )
    .min(1)
    .max(20), // 업로드 큐와 같은 한도
});

export const imageRefSchema = z.object({ companyId: uuid, imageId: uuid, baseVersion: version });

/** 사진 하나 고치기 (수정 화면 사진 탭) — 보낸 칸만 바꾼다 */
export const updateImageSchema = imageRefSchema.extend({
  space: z.enum(PORTFOLIO_SPACES).nullable().optional(),
  spaceLabel: z.string().trim().max(20, { message: 'field.tooLong' }).optional(),
  caption: z.string().trim().max(120, { message: 'field.tooLong' }).optional(),
  role: z.enum(['gallery', 'before', 'after']).optional(),
});

export const portfolioSettingsSchema = z.object({
  companyId: uuid,
  baseVersion: version.nullable(), // 아직 행이 없으면 null
  isPublic: z.boolean(),
  intro: z.string().trim().max(300, { message: 'field.tooLong' }),
  contactPhone: z
    .string()
    .trim()
    .regex(/^[0-9+() -]{7,20}$/, { message: 'field.invalid' })
    .nullable(),
  contactUrl: z
    .string()
    .trim()
    .max(300)
    .regex(/^https:\/\//, { message: 'field.httpsOnly' })
    .nullable(),
  pageTone: z.enum(PORTFOLIO_TONES),
  // 푸터 사업자 정보 (비우면 그 줄을 표시하지 않음)
  businessName: z.string().trim().max(100, { message: 'field.tooLong' }),
  representative: z.string().trim().max(50, { message: 'field.tooLong' }),
  businessRegNo: z
    .string()
    .trim()
    .regex(/^[0-9]{3}-[0-9]{2}-[0-9]{5}$/, { message: 'field.businessRegNo' })
    .nullable(),
  address: z.string().trim().max(200, { message: 'field.tooLong' }),
  csHours: z.string().trim().max(60, { message: 'field.tooLong' }),
  /** 대표 사례 수 = 공개 목록 슬라이드 장수 (DB check 1~6) */
  featuredLimit: z.coerce
    .number()
    .int()
    .min(1, { message: 'field.featuredLimitRange' })
    .max(6, { message: 'field.featuredLimitRange' }),
  // 바닥 칸 (DB 20261108000400)
  footerSlogan: z.string().trim().max(60, { message: 'field.tooLong' }),
  contactEmail: z
    .string()
    .trim()
    .max(120)
    .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, { message: 'field.email' })
    .nullable(),
  mailOrderNo: z.string().trim().max(40, { message: 'field.tooLong' }).nullable(),
  snsLinks: z
    .array(z.string())
    .max(SNS_MAX, { message: 'field.snsMax' })
    .superRefine((list, ctx) => {
      list.forEach((u, i) => {
        if (u.trim() && !checkSns(u).ok)
          ctx.addIssue({ code: 'custom', path: [i], message: 'field.snsInvalid' });
      });
    })
    .transform((list) => cleanSnsList(list)),
  footerTone: z.enum(FOOTER_TONES),
  // 시공 사례 배열 (DB 20261108000500)
  worksLayout: z.enum(['gallery', 'carousel', 'list']),
  galleryFilter: z.boolean(),
  carouselPer: z.union([z.literal(3), z.literal(4)]),
  // 업체가 고치는 작은 문구 (DB 20261108000900 page_labels). 글자 = 직접 쓴 문구 / false = 숨김 / 없음 = 기본
  logoHidden: z.boolean(),
  pageLabels: z
    .object(
      Object.fromEntries(
        LABEL_KEYS.map((k) => [k, z.union([z.string(), z.literal(false)]).optional()]),
      ) as Record<LabelKey, z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<false>]>>>,
    )
    .superRefine((o, ctx) => {
      for (const k of LABEL_KEYS) {
        const v = o[k];
        if (v === false && !canHide(k))
          ctx.addIssue({ code: 'custom', path: [k], message: 'field.required' });
        if (typeof v === 'string' && [...v.trim()].length > LABEL_MAX[k])
          ctx.addIssue({ code: 'custom', path: [k], message: 'field.tooLong' });
      }
    })
    .transform((o) => cleanLabels(o)),
  // 글꼴 + 휴대폰 따로 (DB 20261108000700)
  titleFont: z.enum(TITLE_FONTS),
  bodyFont: z.enum(BODY_FONTS),
  titleWeight: z.union([z.literal(400), z.literal(500), z.literal(600)]),
  mobileWorksLayout: z.enum(['gallery', 'carousel', 'list']).nullable(),
  mobileGalleryCols: z.union([z.literal(1), z.literal(2)]),
});

/** 프로젝트 기간 → 공사 기간(주). 시작·끝 포함, 올림. 기간이 없으면 null */
export function weeksBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000 + 1;
  if (!Number.isFinite(days) || days < 1) return null;
  return Math.min(104, Math.ceil(days / 7));
}

/** 사이트 관리자: 홈페이지 이름 (빈 글 = 업체 이름으로 되돌림) */
export const adminSiteNameSchema = z.object({
  companyId: uuid,
  siteName: z.string().trim().max(60, { message: 'field.tooLong' }),
});
/** 사이트 관리자: 대표자·사업자등록번호 잠금 */
export const adminBusinessLockSchema = z.object({ companyId: uuid, locked: z.boolean() });

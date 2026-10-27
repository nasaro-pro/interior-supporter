// src/features/admin/schema.ts — 사이트 관리 입력 검증. 범위는 마이그레이션 CHECK 와 같다 (20261026000100_a_site_admin.sql)
// 메시지는 errors.json 의 field.* 키
import { z } from 'zod';

/** 사이트 설정 화면 값의 범위 (화면은 MB·GB 단위) */
export const SETTINGS_RANGE = {
  photoMaxMb: { min: 1, max: 100 },
  photoBatchMax: { min: 1, max: 100 },
  designMaxMb: { min: 1, max: 500 },
  quotaMinGb: 0.1,
} as const;

const numberIn = (min: number, max: number, int = false) => {
  let n = z.coerce.number({ message: 'field.number' });
  if (int) n = n.int({ message: 'field.integer' });
  return n.min(min, { message: 'field.invalid' }).max(max, { message: 'field.invalid' });
};

/** 빈 값 = null (한도 없음 / 사이트 기본값) */
const optionalGb = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => (v === null || v === '' ? null : Number(v)))
  .refine((v) => v === null || (Number.isFinite(v) && v >= SETTINGS_RANGE.quotaMinGb), {
    message: 'field.invalid',
  });

export const siteSettingsSchema = z.object({
  photoMaxMb: numberIn(SETTINGS_RANGE.photoMaxMb.min, SETTINGS_RANGE.photoMaxMb.max),
  photoBatchMax: numberIn(SETTINGS_RANGE.photoBatchMax.min, SETTINGS_RANGE.photoBatchMax.max, true),
  designMaxMb: numberIn(SETTINGS_RANGE.designMaxMb.min, SETTINGS_RANGE.designMaxMb.max),
  defaultQuotaGb: optionalGb,
});
export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;

export const companyQuotaSchema = z.object({
  companyId: z.uuid(),
  quotaGb: optionalGb,
});

export const changeOwnerSchema = z.object({
  companyId: z.uuid(),
  newOwnerId: z.uuid({ message: 'field.select' }),
});

export const userTargetSchema = z.object({ userId: z.uuid() });

export const suspendSchema = z.object({
  userId: z.uuid(),
  suspended: z.boolean(),
});

export const purgeFilesSchema = z.object({
  fileIds: z.array(z.uuid()).min(1).max(200),
});

/** 목록 검색어 (URL ?q=) */
export const searchSchema = z
  .string()
  .trim()
  .max(80)
  .optional()
  .transform((v) => (v ? v : undefined));

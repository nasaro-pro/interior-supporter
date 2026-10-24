// photos 입력 검증 — DB CHECK 와 동일 (description ≤ 500, phase 열거형, captured_on date)
import { z } from 'zod';
import { PHOTO_PHASES } from '@/shared/contracts/domain';

export const PHOTO_LIMITS = { description: 500 } as const;

const YMD = /^\d{4}-\d{2}-\d{2}$/;
/** 'YYYY-MM-DD' 달력 값 (존재하는 날짜인지까지 검사, 시간대 변환 없음) */
export const ymdSchema = z
  .string()
  .regex(YMD, 'field.invalid')
  .refine((v) => {
    const [y, m, d] = v.split('-').map(Number) as [number, number, number];
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
  }, 'field.invalid');

const description = z.string().trim().max(PHOTO_LIMITS.description, 'field.tooLong');

export const photoCreateSchema = z.object({
  id: z.guid(),
  projectId: z.guid(),
  fileId: z.guid(),
  thumbFileId: z.guid().nullable(),
  phase: z.enum(PHOTO_PHASES),
  capturedOn: ymdSchema.nullable(),
  description,
  isPublic: z.boolean(),
});
export type PhotoCreateInput = z.infer<typeof photoCreateSchema>;

export const photoUpdateSchema = z.object({
  projectId: z.guid(),
  photoId: z.guid(),
  baseVersion: z.int().positive(),
  phase: z.enum(PHOTO_PHASES),
  capturedOn: ymdSchema.nullable(),
  description,
});
export type PhotoUpdateInput = z.infer<typeof photoUpdateSchema>;

export const photoVisibilitySchema = z.object({
  projectId: z.guid(),
  photoId: z.guid(),
  baseVersion: z.int().positive(),
  isPublic: z.boolean(),
});

export const photoArchiveSchema = z.object({
  projectId: z.guid(),
  photoId: z.guid(),
  baseVersion: z.int().positive(),
  archived: z.boolean(),
});

// 도안·확정 입력 스키마 — 길이는 DB CHECK 와 동일 (20261006000200_b_…sql)
// 메시지 규약: errors.field.<key>[:값] (표준 useFieldErrorText — @/shared/ui/form-parts)
import { z } from 'zod';

const title = z.string().trim().min(1, 'required').max(120, 'tooLong:120');
const description = z.string().trim().max(2000, 'tooLong:2000');
const note = z.string().trim().max(500, 'tooLong:500');

export const designCreateSchema = z.object({
  projectId: z.uuid(),
  title,
  description,
  note,
  isPublic: z.boolean(),
  fileId: z.uuid('fileRequired'),
});
export type DesignCreateInput = z.infer<typeof designCreateSchema>;

export const designVersionAddSchema = z.object({
  projectId: z.uuid(),
  designId: z.uuid(),
  note,
  fileId: z.uuid('fileRequired'),
});
export type DesignVersionAddInput = z.infer<typeof designVersionAddSchema>;

export const designUpdateSchema = z.object({
  projectId: z.uuid(),
  id: z.uuid(),
  baseVersion: z.number().int().positive(),
  title,
  description,
});
export type DesignUpdateInput = z.infer<typeof designUpdateSchema>;

export const designPublishSchema = z.object({
  projectId: z.uuid(),
  id: z.uuid(),
  baseVersion: z.number().int().positive(),
  isPublic: z.boolean(),
});

export const designArchiveSchema = z.object({
  projectId: z.uuid(),
  id: z.uuid(),
  baseVersion: z.number().int().positive(),
  archived: z.boolean(),
});

export const designPreviewAddSchema = z.object({
  projectId: z.uuid(),
  designId: z.uuid(),
  /** POL-038: 폼을 열 때 만든 id — 재시도 중복 방지 */
  id: z.uuid(),
  fileId: z.uuid('fileRequired'),
  label: z.string().trim().min(1, 'required').max(80, 'tooLong:80'),
  designVersionId: z.uuid('invalid').nullable(),
  pdfPage: z.number('number').int('integer').min(1, 'invalid').nullable(),
});
export type DesignPreviewAddInput = z.infer<typeof designPreviewAddSchema>;

export const designPreviewArchiveSchema = z.object({
  projectId: z.uuid(),
  designId: z.uuid(),
  id: z.uuid(),
});

export const CONFIRM_TARGETS = ['designs', 'materials'] as const;
export type ConfirmTargetType = (typeof CONFIRM_TARGETS)[number];

export const confirmTargetSchema = z.object({
  projectId: z.uuid(),
  targetType: z.enum(CONFIRM_TARGETS),
  targetId: z.uuid(),
  /** 화면이 본 리비전 — 다르면 STALE_REVISION (POL-013) */
  revision: z.number().int().min(1),
});
export type ConfirmTargetInput = z.infer<typeof confirmTargetSchema>;

export const reconfirmRequestSchema = z.object({
  projectId: z.uuid(),
  targetType: z.enum(CONFIRM_TARGETS),
  targetId: z.uuid(),
  reason: z.string().trim().min(1, 'required').max(500, 'tooLong:500'),
});
export type ReconfirmRequestInput = z.infer<typeof reconfirmRequestSchema>;

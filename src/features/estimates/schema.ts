// 견적 입력 스키마 — DB CHECK 와 동일 (estimates·estimate_versions). 메시지 규약: errors.field.<key>[:값]
import { z } from 'zod';

const versionLabel = z.string().trim().min(1, 'required').max(40, 'tooLong:40');
/** POL-015: 변경 설명 필수 */
const changeNote = z.string().trim().min(1, 'required').max(1000, 'tooLong:1000');

export const estimateCreateSchema = z.object({
  projectId: z.uuid(),
  /** POL-038: 폼을 열 때 만든 id (견적·버전 각각) */
  id: z.uuid(),
  versionId: z.uuid(),
  title: z.string().trim().min(1, 'required').max(120, 'tooLong:120'),
  versionLabel,
  changeNote,
  fileId: z.uuid('fileRequired'),
  isPublic: z.boolean(),
});
export type EstimateCreateInput = z.infer<typeof estimateCreateSchema>;

export const estimateVersionAddSchema = z.object({
  projectId: z.uuid(),
  estimateId: z.uuid(),
  versionId: z.uuid(),
  versionLabel,
  changeNote,
  fileId: z.uuid('fileRequired'),
  isPublic: z.boolean(),
});
export type EstimateVersionAddInput = z.infer<typeof estimateVersionAddSchema>;

export const estimateVersionPublishSchema = z.object({
  projectId: z.uuid(),
  estimateId: z.uuid(),
  id: z.uuid(),
  baseVersion: z.number().int().positive(),
  isPublic: z.boolean(),
});

/** B-05: 견적 보관·복원 (낙관적 잠금) */
export const estimateArchiveSchema = z.object({
  projectId: z.uuid(),
  id: z.uuid(),
  baseVersion: z.number().int().positive(),
  archived: z.boolean(),
});

/** ?v=N (1 이상 정수). 잘못된 값은 undefined → 최신 버전 */
export function parseVersionNo(raw: string | string[] | undefined): number | undefined {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n >= 1 ? n : undefined;
}

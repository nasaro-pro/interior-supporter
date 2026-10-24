// 자재 입력 스키마 — 길이·범위는 DB CHECK 와 동일 (materials 테이블). 메시지 규약: errors.field.<key>[:값]
import { z } from 'zod';
import { MATERIAL_SPACES } from '@/shared/contracts/domain';

/** 소수 둘째 자리까지 (numeric(12,2)) */
const twoDecimals = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

export const materialFieldsSchema = z.object({
  name: z.string().trim().min(1, 'required').max(120, 'tooLong:120'),
  category: z.string().trim().max(40, 'tooLong:40'),
  space: z.enum(MATERIAL_SPACES, 'select'),
  spec: z.string().trim().max(1000, 'tooLong:1000'),
  quantity: z
    .number('number')
    .min(0, 'nonNegative')
    .max(9_999_999_999.99, 'invalid')
    .refine(twoDecimals, 'decimal2')
    .nullable(),
  unit: z.string().trim().max(20, 'tooLong:20'),
  /** 원 단위 정수 (POL-015·D12) */
  unitPrice: z
    .number('number')
    .int('integer')
    .min(0, 'nonNegative')
    .max(99_999_999_999_999, 'invalid')
    .nullable(),
  /** B-14: 메시지 없는 검증기는 원시 키가 화면에 보인다 → 규약 키 부여 */
  imageFileId: z.uuid('invalid').nullable(),
  locationNote: z.string().trim().max(200, 'tooLong:200'),
  description: z.string().trim().max(2000, 'tooLong:2000'),
});
export type MaterialFields = z.infer<typeof materialFieldsSchema>;

export const materialCreateSchema = materialFieldsSchema.extend({
  projectId: z.uuid(),
  /** POL-038: 폼을 열 때 만든 id */
  id: z.uuid(),
  isPublic: z.boolean(),
});
export type MaterialCreateInput = z.infer<typeof materialCreateSchema>;

export const materialUpdateSchema = materialFieldsSchema.extend({
  projectId: z.uuid(),
  id: z.uuid(),
  baseVersion: z.number().int().positive(),
});
export type MaterialUpdateInput = z.infer<typeof materialUpdateSchema>;

export const materialPublishSchema = z.object({
  projectId: z.uuid(),
  id: z.uuid(),
  baseVersion: z.number().int().positive(),
  isPublic: z.boolean(),
});

export const materialArchiveSchema = z.object({
  projectId: z.uuid(),
  id: z.uuid(),
  baseVersion: z.number().int().positive(),
  archived: z.boolean(),
});

/** POL-012 핵심 필드 — 바꾸면 revision+1, 확정이면 재확인 필요 (DB 트리거와 같은 목록) */
export const MATERIAL_CORE_FIELDS = [
  'name',
  'category',
  'space',
  'spec',
  'quantity',
  'unit',
  'unitPrice',
  'imageFileId',
] as const satisfies readonly (keyof MaterialFields)[];

export function coreFieldsChanged(before: MaterialFields, after: MaterialFields): boolean {
  return MATERIAL_CORE_FIELDS.some((k) => (before[k] ?? null) !== (after[k] ?? null));
}

/** 목록 필터 (카테고리·공간·검색어 독립 결합, REQ-110) */
export interface MaterialFilter {
  category?: string;
  space?: (typeof MATERIAL_SPACES)[number];
  q?: string;
}

export function parseMaterialFilter(
  raw: Record<string, string | string[] | undefined>,
): MaterialFilter {
  const one = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  const space = one(raw.space);
  return {
    category: one(raw.category)?.slice(0, 40),
    space: MATERIAL_SPACES.find((s) => s === space),
    q: one(raw.q)?.slice(0, 100),
  };
}

/** 검색어 정리 — 앞뒤 공백 제거·연속 공백 1칸. 구문 문자는 지우지 않는다 (B-11: "2.5T"·"600*600" 검색) */
export function normalizeSearch(q: string): string {
  return q.replace(/\s+/g, ' ').trim();
}

/**
 * B-11: PostgREST or() 안의 ilike 값 — 큰따옴표 값 문법으로 감싸 `,` `(` `)` `.` `:` 가 구문이 되지 않게 한다.
 * 1) LIKE 와일드카드 `\` `%` `_` 를 `\` 로 이스케이프 (글자 그대로 찾기)
 * 2) 큰따옴표 값 안의 `\` `"` 를 `\` 로 이스케이프
 * 양끝 `*` 는 PostgREST 가 `%` 로 바꾸는 포함 검색. 검색어 안의 `*` 도 PostgREST 가 `%` 로 바꾸므로
 * "600*600" 은 그 글자를 포함한 행을 찾는다(더 넓게 일치할 수는 있어도 빠뜨리지 않는다).
 */
export function ilikeValue(term: string): string {
  const like = term.replace(/[\\%_]/g, (c) => `\\${c}`);
  const quoted = like.replace(/[\\"]/g, (c) => `\\${c}`);
  return `"*${quoted}*"`;
}

/** 이름·사양 포함 검색 or() 필터 문자열 (빈 검색어면 null) */
export function materialSearchFilter(q: string | undefined): string | null {
  const term = q ? normalizeSearch(q) : '';
  if (!term) return null;
  const v = ilikeValue(term);
  return `name.ilike.${v},spec.ilike.${v}`;
}

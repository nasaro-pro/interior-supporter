// requests 입력 검증 — DB CHECK 길이와 동일 (20261006000300_c_requests_photos_schedule.sql)
// 오류 메시지 값은 errors.json 의 field.* 키다 (헌법 7.2)
import { z } from 'zod';
import { REQUEST_STATUSES, REQUEST_TRANSITIONS } from '@/shared/contracts/domain';

export const REQUEST_LIMITS = { title: 120, body: 4000 } as const;

const body = z.string().trim().min(1, 'field.required').max(REQUEST_LIMITS.body, 'field.tooLong');

/** D-32: 메모를 다는 항목 (도안 · 자재) */
export const REQUEST_TARGET_TYPES = ['designs', 'materials'] as const;
export type RequestTargetType = (typeof REQUEST_TARGET_TYPES)[number];

export const requestCreateSchema = z
  .object({
    id: z.guid(),
    projectId: z.guid(),
    /** D-33: 비우면 서버가 본문 앞부분으로 만든다 */
    title: z.string().trim().max(REQUEST_LIMITS.title, 'field.tooLong').default(''),
    body,
    targetType: z.enum(REQUEST_TARGET_TYPES).nullable().default(null),
    targetId: z.guid().nullable().default(null),
  })
  .refine((v) => (v.targetType === null) === (v.targetId === null), {
    path: ['targetId'],
    message: 'field.invalid',
  });
export type RequestCreateInput = z.infer<typeof requestCreateSchema>;

/** 정정·답변 공통 (POL-018: 정정 = 원 작성자, 답변 = 편집자 — 권한은 액션·RLS 가 판정) */
export const requestEntrySchema = z.object({
  id: z.guid(),
  projectId: z.guid(),
  requestId: z.guid(),
  body,
});
export type RequestEntryInput = z.infer<typeof requestEntrySchema>;

/** ST-200: 허용 전환만 (REQUEST_TRANSITIONS) */
export const requestStatusSchema = z
  .object({
    projectId: z.guid(),
    requestId: z.guid(),
    baseVersion: z.int().positive(),
    from: z.enum(REQUEST_STATUSES),
    to: z.enum(REQUEST_STATUSES),
  })
  .refine((v) => REQUEST_TRANSITIONS[v.from].includes(v.to), {
    path: ['to'],
    message: 'field.invalid',
  });
export type RequestStatusInput = z.infer<typeof requestStatusSchema>;

export const requestArchiveSchema = z.object({
  projectId: z.guid(),
  requestId: z.guid(),
  baseVersion: z.int().positive(),
  archived: z.boolean(),
});
export type RequestArchiveInput = z.infer<typeof requestArchiveSchema>;

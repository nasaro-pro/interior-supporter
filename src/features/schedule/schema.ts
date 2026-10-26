// schedule 입력 검증 — DB CHECK 와 동일 (종료일 ≥ 시작일, 종료 시각은 시작 시각 필요, 같은 날 시각 순서, 관련 항목 쌍)
import { z } from 'zod';
import { ymdSchema } from '@/features/photos';

export const SCHEDULE_LIMITS = { title: 120, description: 2000 } as const;
export const RELATED_TYPES = [
  'designs',
  'materials',
  'estimate_versions',
  'requests',
  'photos',
] as const;
export type RelatedType = (typeof RELATED_TYPES)[number];
/** D-30 일정 진행 상태 (DB CHECK 와 동일) */
export const SCHEDULE_PROGRESS = ['planned', 'in_progress', 'done'] as const;
export type ScheduleProgress = (typeof SCHEDULE_PROGRESS)[number];

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'field.invalid');

const fields = {
  title: z.string().trim().min(1, 'field.required').max(SCHEDULE_LIMITS.title, 'field.tooLong'),
  description: z.string().trim().max(SCHEDULE_LIMITS.description, 'field.tooLong'),
  startDate: ymdSchema,
  startTime: hm.nullable(),
  endDate: ymdSchema.nullable(),
  endTime: hm.nullable(),
  isPublic: z.boolean(),
  /** 보내지 않으면 바꾸지 않음 (새 일정은 DB 기본값 '예정') */
  progress: z.enum(SCHEDULE_PROGRESS, 'field.invalid').optional(),
  relatedType: z.enum(RELATED_TYPES).nullable(),
  relatedId: z.guid().nullable(),
};

type Fields = {
  startDate: string;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  relatedType: RelatedType | null;
  relatedId: string | null;
};

function checkSchedule(v: Fields, ctx: z.RefinementCtx) {
  if (v.endDate !== null && v.endDate < v.startDate) {
    ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'field.dateOrder' });
  }
  if (v.endTime !== null && v.startTime === null) {
    ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'field.endTimeNeedsStart' });
  }
  const sameDay = v.endDate === null || v.endDate === v.startDate;
  if (sameDay && v.startTime !== null && v.endTime !== null && v.endTime < v.startTime) {
    ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'field.timeOrder' });
  }
  if ((v.relatedType === null) !== (v.relatedId === null)) {
    ctx.addIssue({ code: 'custom', path: ['relatedId'], message: 'field.invalid' });
  }
}

export const scheduleCreateSchema = z
  .object({ id: z.guid(), projectId: z.guid(), ...fields })
  .superRefine(checkSchedule);
export type ScheduleCreateInput = z.infer<typeof scheduleCreateSchema>;

export const scheduleUpdateSchema = z
  .object({ eventId: z.guid(), projectId: z.guid(), baseVersion: z.int().positive(), ...fields })
  .superRefine(checkSchedule);
export type ScheduleUpdateInput = z.infer<typeof scheduleUpdateSchema>;

/** 폼 전용 (id·projectId 는 컴포넌트가 붙인다) */
export const scheduleFormSchema = z.object(fields).superRefine(checkSchedule);
export type ScheduleFormValues = z.infer<typeof scheduleFormSchema>;

export const scheduleArchiveSchema = z.object({
  eventId: z.guid(),
  projectId: z.guid(),
  baseVersion: z.int().positive(),
  archived: z.boolean(),
});

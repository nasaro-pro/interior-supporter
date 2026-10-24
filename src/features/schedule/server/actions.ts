'use server';
// schedule Server Actions — 편집자만 (권한표: 일정 등록·수정). 공개 일정 변경 알림은 DB 트리거 (notify_schedule)
import { revalidatePath } from 'next/cache';
import { getAccessContext, requireProjectAccess } from '@/features/core';
import { fail, ok, type ActionResult } from '@/shared/contracts/errors';
import type { ProjectAccess } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import {
  dbFail,
  explainZeroRow,
  nowIso,
  validationFail,
} from '@/features/requests/lib/action-helpers';
import { checkRelatedTarget } from './related';
import {
  scheduleArchiveSchema,
  scheduleCreateSchema,
  scheduleUpdateSchema,
  type ScheduleFormValues,
} from '../schema';

/** 일정 원본은 하나 — 프로젝트 일정·전체 캘린더·고객 일정·홈 다음 일정이 모두 같은 행을 본다 (INT-07) */
function revalidateSchedule(access: ProjectAccess, eventId?: string) {
  const { companySlug, projectId } = access;
  revalidatePath(routes.app.project(companySlug, projectId, 'schedule'));
  revalidatePath(routes.app.calendar(companySlug));
  revalidatePath(routes.portal.project(projectId, 'schedule'));
  revalidatePath(routes.app.project(companySlug, projectId, 'overview'));
  revalidatePath(routes.portal.project(projectId, 'home'));
  if (eventId) {
    revalidatePath(routes.app.scheduleEvent(companySlug, projectId, eventId));
    revalidatePath(routes.portal.scheduleEvent(projectId, eventId));
  }
}

/**
 * 관련 항목 검사 — 다른 프로젝트 항목도 허용(C 결정 2026-10-07)하되 같은 업체·현재 사용자가 볼 수 있는 항목만.
 * 다른 업체 항목과 볼 수 없는 항목은 같은 오류로 돌려 존재를 숨긴다 (P-01).
 */
async function relatedProblem(
  values: Pick<ScheduleFormValues, 'relatedType' | 'relatedId'>,
  companyId: string,
): Promise<ActionResult<never> | null> {
  if (!values.relatedType || !values.relatedId) return null;
  const result = await checkRelatedTarget(values.relatedType, values.relatedId, companyId);
  if (result === 'ok') return null;
  return fail('VALIDATION_FAILED', { fieldErrors: { relatedId: ['field.invalid'] } });
}

const toColumns = (v: ScheduleFormValues) => ({
  title: v.title,
  description: v.description,
  start_date: v.startDate,
  start_time: v.startTime,
  end_date: v.endDate,
  end_time: v.endTime,
  is_public: v.isPublic,
  related_type: v.relatedType,
  related_id: v.relatedId,
});

export async function createScheduleEvent(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = scheduleCreateSchema.safeParse(raw);
  if (!parsed.success) return validationFail(parsed.error);
  const { id, projectId, ...values } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  const problem = await relatedProblem(values, access.companyId);
  if (problem) return problem;
  const ctx = await getAccessContext();
  const supabase = await createServerSupabase();
  const { error } = await supabase.from('schedule_events').insert({
    id,
    project_id: projectId,
    company_id: access.companyId,
    created_by: ctx.userId,
    ...toColumns(values),
  });
  if (error) {
    if (error.code === '23505') {
      const { data } = await supabase
        .from('schedule_events')
        .select('id')
        .eq('id', id)
        .maybeSingle();
      if (data) {
        revalidateSchedule(access, id);
        return ok({ id });
      }
    }
    return dbFail('schedule.create.failed', error, { projectId, objectId: id });
  }
  revalidateSchedule(access, id);
  return ok({ id });
}

export async function updateScheduleEvent(
  raw: unknown,
): Promise<ActionResult<{ version: number }>> {
  const parsed = scheduleUpdateSchema.safeParse(raw);
  if (!parsed.success) return validationFail(parsed.error);
  const { eventId, projectId, baseVersion, ...values } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  const problem = await relatedProblem(values, access.companyId);
  if (problem) return problem;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('schedule_events')
    .update(toColumns(values))
    .eq('id', eventId)
    .eq('project_id', projectId)
    .eq('version', baseVersion)
    .is('archived_at', null) // C-04: 보관 일정은 수정 불가 (서버 강제)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('schedule.update.failed', error, { projectId, objectId: eventId });
  if (!data) {
    // 0행 원인 구분: 없음(존재 숨김) / 보관(CONFLICT) / 다른 사람이 먼저 수정(VERSION_CONFLICT)
    const { data: current } = await supabase
      .from('schedule_events')
      .select('archived_at')
      .eq('id', eventId)
      .eq('project_id', projectId)
      .maybeSingle();
    return explainZeroRow(current);
  }
  revalidateSchedule(access, eventId);
  return ok({ version: data.version });
}

export async function setScheduleEventArchived(
  raw: unknown,
): Promise<ActionResult<{ version: number }>> {
  const parsed = scheduleArchiveSchema.safeParse(raw);
  if (!parsed.success) return validationFail(parsed.error);
  const { eventId, projectId, baseVersion, archived } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('schedule_events')
    .update({ archived_at: archived ? nowIso() : null })
    .eq('id', eventId)
    .eq('project_id', projectId)
    .eq('version', baseVersion)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('schedule.archive.failed', error, { projectId, objectId: eventId });
  if (!data) return fail('VERSION_CONFLICT');
  revalidateSchedule(access, eventId);
  return ok({ version: data.version });
}

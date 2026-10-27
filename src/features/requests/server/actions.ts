'use server';
// requests Server Actions — 03 문서 5.1 표준 형태 (zod → 접근 검사 → RLS → ActionResult)
import { revalidatePath } from 'next/cache';
import { getAccessContext, requireProjectAccess } from '@/features/core';
import { fail, ok, type ActionResult } from '@/shared/contracts/errors';
import type { ProjectAccess } from '@/shared/contracts/integration';
import type { RequestStatus } from '@/shared/contracts/domain';
import { routes } from '@/shared/contracts/routes';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import {
  dbFail,
  explainZeroRow,
  isUniqueViolation,
  nowIso,
  validationFail,
} from '../lib/action-helpers';
import {
  requestArchiveSchema,
  requestCreateSchema,
  requestEntrySchema,
  requestStatusSchema,
  type RequestTargetType,
} from '../schema';
import { autoTitle } from '../lib/memo';

function revalidateRequest(access: ProjectAccess, requestId?: string) {
  const { companySlug, projectId } = access;
  revalidatePath(routes.app.project(companySlug, projectId, 'requests'));
  revalidatePath(routes.portal.project(projectId, 'requests'));
  if (requestId) {
    revalidatePath(routes.app.request(companySlug, projectId, requestId));
    revalidatePath(routes.portal.request(projectId, requestId));
  }
}

/** D-32: 메모가 보이는 도안 · 자재 상세 화면도 갱신 */
function revalidateTarget(access: ProjectAccess, type: RequestTargetType, targetId: string) {
  const { companySlug: c, projectId: p } = access;
  if (type === 'designs') {
    revalidatePath(routes.app.design(c, p, targetId));
    revalidatePath(routes.portal.design(p, targetId));
  } else {
    revalidatePath(routes.app.material(c, p, targetId));
    revalidatePath(routes.portal.material(p, targetId));
  }
}

/** REQ-201: 고객만 작성. 상태 open·작성자·범위는 DB 트리거가 강제 */
export async function createRequest(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = requestCreateSchema.safeParse(raw);
  if (!parsed.success) return validationFail(parsed.error);
  const { id, projectId, title, body, targetType, targetId } = parsed.data;
  const access = await requireProjectAccess(projectId, ['customer']);
  const ctx = await getAccessContext();
  const supabase = await createServerSupabase();
  const { error } = await supabase.from('requests').insert({
    id,
    project_id: projectId,
    company_id: access.companyId,
    author_id: ctx.userId,
    // D-33: 제목을 비우면 본문 앞부분으로
    title: title || autoTitle(body),
    body,
    // D-32: 연결 항목 — 같은 프로젝트의 공개 항목만 (DB 트리거가 확인)
    target_type: targetType,
    target_id: targetId,
  });
  if (error) {
    if (isUniqueViolation(error)) {
      // POL-038: 같은 id 재시도 → 이미 저장된 행을 성공으로
      const { data } = await supabase.from('requests').select('id').eq('id', id).maybeSingle();
      if (data) {
        revalidateRequest(access, id);
        return ok({ id });
      }
      return fail('CONFLICT');
    }
    if (error.message === 'invalid_target') {
      return fail('VALIDATION_FAILED', { fieldErrors: { targetId: ['field.invalid'] } });
    }
    return dbFail('request.create.failed', error, { projectId, objectId: id });
  }
  revalidateRequest(access, id);
  if (targetType && targetId) revalidateTarget(access, targetType, targetId);
  return ok({ id });
}

/** 같은 프로젝트의 요청인지 먼저 확인 (다른 프로젝트 id 바꿔치기 차단, 존재 숨김) */
async function requestInProject(projectId: string, requestId: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('requests')
    .select('id, archived_at')
    .eq('id', requestId)
    .eq('project_id', projectId)
    .maybeSingle();
  return data;
}

async function insertEntry(
  table: 'request_corrections' | 'request_replies',
  access: ProjectAccess,
  input: { id: string; projectId: string; requestId: string; body: string },
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAccessContext();
  const supabase = await createServerSupabase();
  const { error } = await supabase.from(table).insert({
    id: input.id,
    request_id: input.requestId,
    company_id: access.companyId,
    project_id: input.projectId,
    author_id: ctx.userId,
    body: input.body,
  });
  if (error) {
    if (isUniqueViolation(error)) {
      const { data } = await supabase.from(table).select('id').eq('id', input.id).maybeSingle();
      if (data) {
        revalidateRequest(access, input.requestId);
        return ok({ id: input.id });
      }
      return fail('CONFLICT');
    }
    return dbFail(`${table}.insert.failed`, error, {
      projectId: input.projectId,
      objectId: input.requestId,
    });
  }
  revalidateRequest(access, input.requestId);
  return ok({ id: input.id });
}

/** REQ-203: 원 작성자(고객)만 정정 추가 — 원문은 그대로, 상태 자동 변경 없음 */
export async function addRequestCorrection(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = requestEntrySchema.safeParse(raw);
  if (!parsed.success) return validationFail(parsed.error);
  const access = await requireProjectAccess(parsed.data.projectId, ['customer']);
  const target = await requestInProject(parsed.data.projectId, parsed.data.requestId);
  if (!target) return fail('NOT_FOUND');
  if (target.archived_at) return fail('CONFLICT');
  return insertEntry('request_corrections', access, parsed.data);
}

/** REQ-204: 편집자 답변 추가 (수정·삭제 없음) */
export async function addRequestReply(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = requestEntrySchema.safeParse(raw);
  if (!parsed.success) return validationFail(parsed.error);
  const access = await requireProjectAccess(parsed.data.projectId, ['editor']);
  const target = await requestInProject(parsed.data.projectId, parsed.data.requestId);
  if (!target) return fail('NOT_FOUND');
  if (target.archived_at) return fail('CONFLICT'); // C-04: 보관된 요청엔 답변 불가 (서버 강제)
  return insertEntry('request_replies', access, parsed.data);
}

/** REQ-205: 허용 전환만 + version 잠금 */
export async function changeRequestStatus(
  raw: unknown,
): Promise<ActionResult<{ version: number; status: RequestStatus }>> {
  const parsed = requestStatusSchema.safeParse(raw);
  if (!parsed.success) return validationFail(parsed.error);
  const { projectId, requestId, baseVersion, from, to } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('requests')
    .update({ status: to })
    .eq('id', requestId)
    .eq('project_id', projectId)
    .eq('version', baseVersion)
    .eq('status', from)
    .is('archived_at', null) // C-04: 보관된 요청은 상태를 바꿀 수 없다
    .select('version, status')
    .maybeSingle();
  if (error) return dbFail('request.status.failed', error, { projectId, objectId: requestId });
  if (!data) {
    // 0행 원인 구분: 없음(존재 숨김) / 보관(CONFLICT) / 다른 사람이 먼저 바꿈(VERSION_CONFLICT)
    return explainZeroRow(await requestInProject(projectId, requestId));
  }
  revalidateRequest(access, requestId);
  return ok({ version: data.version, status: data.status });
}

/** POL-020: 삭제 대신 보관·복원 (편집자) */
export async function setRequestArchived(raw: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = requestArchiveSchema.safeParse(raw);
  if (!parsed.success) return validationFail(parsed.error);
  const { projectId, requestId, baseVersion, archived } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('requests')
    .update({ archived_at: archived ? nowIso() : null })
    .eq('id', requestId)
    .eq('project_id', projectId)
    .eq('version', baseVersion)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('request.archive.failed', error, { projectId, objectId: requestId });
  if (!data) return fail('VERSION_CONFLICT');
  revalidateRequest(access, requestId);
  return ok({ version: data.version });
}

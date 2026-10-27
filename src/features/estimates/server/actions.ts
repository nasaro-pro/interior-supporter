'use server';
// 견적 Server Actions (REQ-131·133) — 번호는 DB 트리거가 행 잠금으로 부여, 올린 PDF 는 바꿀 수 없다 (POL-015)
// D-05: 견적 묶음과 첫 버전은 create_estimate RPC 한 번으로 저장한다(한 트랜잭션 — 버전 실패 시 견적도 남지 않음).
import { revalidatePath } from 'next/cache';
import { requireProjectAccess } from '@/features/core';
import { fail, ok, type ActionResult } from '@/shared/contracts/errors';
import type { ProjectAccess } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { dbFail, explainNoRow, invalid } from '@/features/designs/server/result';
import { canManageEstimates } from '@/features/estimates/server/permission';
import {
  estimateArchiveSchema,
  estimateCreateSchema,
  estimateVersionAddSchema,
  estimateVersionPublishSchema,
} from '@/features/estimates/schema';

function revalidateEstimate(access: ProjectAccess, estimateId: string) {
  const { companySlug: c, projectId: p } = access;
  revalidatePath(routes.app.project(c, p, 'estimates'));
  revalidatePath(routes.app.estimate(c, p, estimateId));
  revalidatePath(routes.portal.project(p, 'estimates'));
  revalidatePath(routes.portal.estimate(p, estimateId));
}

async function insertVersion(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  v: {
    versionId: string;
    estimateId: string;
    projectId: string;
    companyId: string;
    uploadedBy: string;
    versionLabel: string;
    changeNote: string;
    fileId: string;
    isPublic: boolean;
  },
): Promise<ActionResult<{ versionNo: number }>> {
  const { data, error } = await supabase
    .from('estimate_versions')
    .insert({
      id: v.versionId,
      estimate_id: v.estimateId,
      project_id: v.projectId,
      // 아래 3개는 DB 트리거가 덮어쓴다 (scope·a_number). NOT NULL 컬럼이라 타입상 값을 보낸다 — PATCH_LOG P1-B-03
      company_id: v.companyId,
      uploaded_by: v.uploadedBy,
      version_no: 0,
      version_label: v.versionLabel,
      change_note: v.changeNote,
      file_id: v.fileId,
      is_public: v.isPublic,
    })
    .select('version_no')
    .single();
  if (error) {
    // POL-038: 같은 id 재시도 → 이미 저장된 버전을 성공으로 반환.
    // B-04: 그 버전이 이 견적의 것이어야 한다 (다른 견적·프로젝트의 id 와 충돌하면 CONFLICT)
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('estimate_versions')
        .select('version_no, estimate_id, project_id')
        .eq('id', v.versionId)
        .maybeSingle();
      if (existing) {
        if (existing.estimate_id !== v.estimateId || existing.project_id !== v.projectId)
          return fail('CONFLICT');
        return ok({ versionNo: existing.version_no });
      }
    }
    return dbFail('estimate.version.insert_failed', error, {
      projectId: v.projectId,
      objectId: v.estimateId,
    });
  }
  return ok({ versionNo: data.version_no });
}

/** REQ-131: 견적 등록 = 견적 묶음 + 첫 버전 (D-05: 원자적 RPC) */
export async function createEstimate(
  raw: unknown,
): Promise<ActionResult<{ id: string; versionNo: number }>> {
  const parsed = estimateCreateSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { projectId, id, versionId, title, versionLabel, changeNote, fileId, isPublic } =
    parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  // D-37: 견적서는 업체관리자만 바꾼다 (담당자는 보기만)
  if (!(await canManageEstimates(access.companyId))) return fail('FORBIDDEN');
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return fail('UNAUTHENTICATED');
  const { data, error } = await supabase.rpc('create_estimate', {
    p_id: id,
    p_version_id: versionId,
    p_project: projectId,
    p_title: title,
    p_version_label: versionLabel,
    p_change_note: changeNote,
    p_file: fileId,
    p_is_public: isPublic,
  });
  if (error) {
    if (error.code !== '23505') return dbFail('estimate.create.failed', error, { projectId });
    // 23505 = 같은 폼의 재시도(이미 둘 다 저장됨). 그 버전이 이 견적·프로젝트의 것일 때만 성공 (POL-038)
    const { data: existing, error: lookupError } = await supabase
      .from('estimate_versions')
      .select('version_no, estimate_id, project_id')
      .eq('id', versionId)
      .maybeSingle();
    if (lookupError) return dbFail('estimate.create.recheck_failed', lookupError, { projectId });
    if (!existing || existing.estimate_id !== id || existing.project_id !== projectId)
      return fail('CONFLICT');
    revalidateEstimate(access, id);
    return ok({ id, versionNo: existing.version_no });
  }
  revalidateEstimate(access, id);
  return ok({ id, versionNo: data });
}

/** REQ-131: 새 버전 (과거 PDF 덮어쓰기 불가 — 항상 새 행) */
export async function addEstimateVersion(
  raw: unknown,
): Promise<ActionResult<{ versionNo: number }>> {
  const parsed = estimateVersionAddSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { projectId, estimateId, ...rest } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  // D-37: 견적서는 업체관리자만 바꾼다 (담당자는 보기만)
  if (!(await canManageEstimates(access.companyId))) return fail('FORBIDDEN');
  const supabase = await createServerSupabase();
  const { data: estimate } = await supabase
    .from('estimates')
    .select('id, archived_at')
    .eq('id', estimateId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (!estimate) return fail('NOT_FOUND');
  if (estimate.archived_at) return fail('CONFLICT');
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return fail('UNAUTHENTICATED');
  const res = await insertVersion(supabase, {
    ...rest,
    estimateId,
    projectId,
    companyId: access.companyId,
    uploadedBy: user.user.id,
  });
  if (!res.ok) return res;
  revalidateEstimate(access, estimateId);
  return res;
}

/** REQ-133: 버전별 공개 토글 (최초 공개 시각은 DB 트리거가 기록, 공개 시 고객 알림) */
export async function setEstimateVersionPublic(
  raw: unknown,
): Promise<ActionResult<{ version: number }>> {
  const parsed = estimateVersionPublishSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { projectId, estimateId, id, baseVersion, isPublic } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  // D-37: 견적서는 업체관리자만 바꾼다 (담당자는 보기만)
  if (!(await canManageEstimates(access.companyId))) return fail('FORBIDDEN');
  const supabase = await createServerSupabase();
  // B-06: 보관된 견적의 버전은 공개 전환하지 않는다 (읽기 전용)
  const { data: parent, error: parentError } = await supabase
    .from('estimates')
    .select('archived_at')
    .eq('id', estimateId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (parentError) return dbFail('estimate.publish.lookup_failed', parentError, { projectId });
  if (!parent) return fail('NOT_FOUND');
  if (parent.archived_at) return fail('CONFLICT');
  const { data, error } = await supabase
    .from('estimate_versions')
    .update({ is_public: isPublic })
    .eq('id', id)
    .eq('estimate_id', estimateId)
    .eq('project_id', projectId)
    .eq('version', baseVersion)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('estimate.publish.failed', error, { projectId, objectId: id });
  if (!data)
    return explainNoRow(
      supabase
        .from('estimate_versions')
        .select('version, archived_at')
        .eq('id', id)
        .eq('estimate_id', estimateId)
        .eq('project_id', projectId)
        .maybeSingle(),
      baseVersion,
      { rejectArchived: true, msg: 'estimate.publish.recheck_failed', fields: { projectId } },
    );
  revalidateEstimate(access, estimateId);
  return ok({ version: data.version });
}

/** B-05: 견적 보관·복원 (DELETE 없음, 낙관적 잠금). 보관하면 고객 목록·홈에서 사라지고 PM 보관함에 남는다 */
export async function setEstimateArchived(
  raw: unknown,
): Promise<ActionResult<{ version: number }>> {
  const parsed = estimateArchiveSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { projectId, id, baseVersion, archived } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  // D-37: 견적서는 업체관리자만 바꾼다 (담당자는 보기만)
  if (!(await canManageEstimates(access.companyId))) return fail('FORBIDDEN');
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('estimates')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id)
    .eq('project_id', projectId)
    .eq('version', baseVersion)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('estimate.archive.failed', error, { projectId, objectId: id });
  if (!data)
    return explainNoRow(
      supabase
        .from('estimates')
        .select('version, archived_at')
        .eq('id', id)
        .eq('project_id', projectId)
        .maybeSingle(),
      baseVersion,
      { rejectArchived: false, msg: 'estimate.archive.recheck_failed', fields: { projectId } },
    );
  revalidateEstimate(access, id);
  return ok({ version: data.version });
}

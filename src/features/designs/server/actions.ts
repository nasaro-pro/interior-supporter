'use server';
// 도안 Server Actions (REQ-101·102·104·106) — 생성·새 버전은 RPC 만 (create_design, add_design_version)
import { revalidatePath } from 'next/cache';
import { requireProjectAccess } from '@/features/core';
import { fail, ok, type ActionResult } from '@/shared/contracts/errors';
import type { ProjectAccess } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import {
  designArchiveSchema,
  designCreateSchema,
  designMainSchema,
  designMoveSchema,
  designSpaceMoveSchema,
  designPreviewAddSchema,
  designPreviewArchiveSchema,
  designPublishSchema,
  designUpdateSchema,
  designVersionAddSchema,
} from '@/features/designs/schema';
import { dbFail, explainNoRow, invalid } from '@/features/designs/server/result';
import { groupBySpace, moveSpace, moveWithinSpace } from '@/features/designs/lib/order';

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

/** 0행 update 원인 구분용 재조회 (B-08) */
function lockedDesign(supabase: Supabase, projectId: string, id: string) {
  return supabase
    .from('designs')
    .select('version, archived_at')
    .eq('id', id)
    .eq('project_id', projectId)
    .maybeSingle();
}

function revalidateDesign(access: ProjectAccess, designId?: string) {
  const { companySlug: c, projectId: p } = access;
  revalidatePath(routes.app.project(c, p, 'designs'));
  revalidatePath(routes.portal.project(p, 'designs'));
  if (designId) {
    revalidatePath(routes.app.design(c, p, designId));
    revalidatePath(routes.portal.design(p, designId));
  }
}

/** REQ-101: 도안 + 1번 버전 원자적 생성 (파일은 finalize 로 ready 가 된 design_original) */
export async function createDesign(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = designCreateSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { projectId, title, description, note, isPublic, fileId, space } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('create_design', {
    p_project: projectId,
    p_title: title,
    p_description: description,
    p_file: fileId,
    p_note: note,
    p_is_public: isPublic,
  });
  if (error) return dbFail('design.create.failed', error, { projectId });
  // D-26: 공간은 생성 뒤 바로 지정 (create_design RPC 는 베이스라인 고정). 실패해도 도안은 남고 수정 화면에서 다시 지정
  if (space) {
    const { error: spaceError } = await supabase
      .from('designs')
      .update({ space })
      .eq('id', data)
      .eq('project_id', projectId);
    if (spaceError) dbFail('design.create.space_failed', spaceError, { projectId, objectId: data });
  }
  revalidateDesign(access, data);
  return ok({ id: data });
}

/** REQ-102: 새 버전 (확정이면 DB 가 재확인 필요로 바꾸고 기존 기록을 무효화) */
export async function addDesignVersion(
  raw: unknown,
): Promise<ActionResult<{ versionId: string; reconfirm: boolean }>> {
  const parsed = designVersionAddSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { projectId, designId, note, fileId } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  const supabase = await createServerSupabase();
  const { data: before, error: beforeError } = await supabase
    .from('designs')
    .select('archived_at')
    .eq('id', designId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (beforeError)
    return dbFail('design.version.lookup_failed', beforeError, { projectId, objectId: designId });
  if (!before) return fail('NOT_FOUND');
  // B-06: 보관된 도안에는 새 버전을 올리지 않는다 (RPC 도 'archived' → CONFLICT 로 거절)
  if (before.archived_at) return fail('CONFLICT');
  const { data, error } = await supabase.rpc('add_design_version', {
    p_design: designId,
    p_file: fileId,
    p_note: note,
  });
  if (error) return dbFail('design.version.failed', error, { projectId, objectId: designId });
  revalidateDesign(access, designId);
  return ok({ versionId: data, reconfirm: await reconfirmedBy(supabase, designId, data) });
}

/**
 * B-09: 재확인 전환 여부는 RPC 뒤에 판정한다 (미리 읽은 confirm_state 는 그 사이 확정·재확인 요청과 경합).
 * 이 RPC 가 만든 버전(N)이 확정을 무효화했다면 'new_version' 사유로 무효화된 리비전 N-1 확정 기록이 있다
 * (unique(target_type, target_id, target_revision) + RPC 의 for update 로 다른 호출과 겹치지 않는다).
 * 재조회 실패는 새 버전 저장 성공을 뒤집지 않는다 — 로그만 남기고 안내 문구를 일반 문구로 둔다.
 */
async function reconfirmedBy(supabase: Supabase, designId: string, versionId: string) {
  const { data: version, error: vError } = await supabase
    .from('design_versions')
    .select('version_no')
    .eq('id', versionId)
    .maybeSingle();
  if (vError || !version) {
    if (vError) dbFail('design.version.reconfirm_lookup_failed', vError, { objectId: designId });
    return false;
  }
  const { data: invalidated, error: cError } = await supabase
    .from('confirmations')
    .select('id')
    .eq('target_type', 'designs')
    .eq('target_id', designId)
    .eq('target_revision', version.version_no - 1)
    .eq('invalidated_reason', 'new_version')
    .not('invalidated_at', 'is', null)
    .maybeSingle();
  if (cError) {
    dbFail('design.version.reconfirm_lookup_failed', cError, { objectId: designId });
    return false;
  }
  return !!invalidated;
}

/** REQ-106: 제목·설명 수정 (낙관적 잠금) */
export async function updateDesign(raw: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = designUpdateSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { projectId, id, baseVersion, title, description, space } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('designs')
    // D-26: space 를 보내지 않은 호출(기존 화면)은 공간을 건드리지 않는다
    .update(space === undefined ? { title, description } : { title, description, space })
    .eq('id', id)
    .eq('project_id', projectId)
    .eq('version', baseVersion)
    .is('archived_at', null) // B-06: 보관된 도안은 수정하지 않는다
    .select('version')
    .maybeSingle();
  if (error) return dbFail('design.update.failed', error, { projectId, objectId: id });
  if (!data)
    return explainNoRow(lockedDesign(supabase, projectId, id), baseVersion, {
      rejectArchived: true,
      msg: 'design.update.recheck_failed',
      fields: { projectId, objectId: id },
    });
  revalidateDesign(access, id);
  return ok({ version: data.version });
}

/** REQ-106: 공개 전환 (공개 시 고객 알림은 DB 트리거) */
export async function setDesignPublic(raw: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = designPublishSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { projectId, id, baseVersion, isPublic } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('designs')
    .update({ is_public: isPublic })
    .eq('id', id)
    .eq('project_id', projectId)
    .eq('version', baseVersion)
    .is('archived_at', null) // B-06: 보관 중에는 공개 전환 불가 (복원 후)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('design.publish.failed', error, { projectId, objectId: id });
  if (!data)
    return explainNoRow(lockedDesign(supabase, projectId, id), baseVersion, {
      rejectArchived: true,
      msg: 'design.publish.recheck_failed',
      fields: { projectId, objectId: id },
    });
  revalidateDesign(access, id);
  return ok({ version: data.version });
}

/** 보관·복원 (DELETE 없음) */
export async function setDesignArchived(raw: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = designArchiveSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { projectId, id, baseVersion, archived } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('designs')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id)
    .eq('project_id', projectId)
    .eq('version', baseVersion)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('design.archive.failed', error, { projectId, objectId: id });
  if (!data)
    return explainNoRow(lockedDesign(supabase, projectId, id), baseVersion, {
      rejectArchived: false,
      msg: 'design.archive.recheck_failed',
      fields: { projectId, objectId: id },
    });
  revalidateDesign(access, id);
  return ok({ version: data.version });
}

/** REQ-104: 비교 이미지 등록 (이미지 업로드 또는 PDF 페이지 PNG). 파일 연결은 DB 트리거(attach_file) */
export async function addDesignPreview(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = designPreviewAddSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { projectId, designId, id, fileId, label, designVersionId, pdfPage } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return fail('UNAUTHENTICATED');
  // B-06·B-13: 이 프로젝트의 보관되지 않은 도안에만 비교 이미지를 붙인다
  const { data: design, error: designError } = await supabase
    .from('designs')
    .select('id, archived_at')
    .eq('id', designId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (designError) return dbFail('design.preview.lookup_failed', designError, { projectId });
  if (!design) return fail('NOT_FOUND');
  if (design.archived_at) return fail('CONFLICT');
  const { error } = await supabase.from('design_previews').insert({
    id,
    design_id: designId,
    company_id: access.companyId, // 트리거(scope)가 상위 도안에서 덮어씀 — PATCH_LOG P1-B-03
    project_id: projectId,
    design_version_id: designVersionId,
    file_id: fileId,
    label,
    pdf_page: pdfPage,
    created_by: user.user.id,
  });
  if (error) {
    // POL-038: 같은 id 재시도 = 이미 저장됨 → 성공으로 처리
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('design_previews')
        .select('id')
        .eq('id', id)
        .eq('design_id', designId)
        .maybeSingle();
      if (existing) return ok({ id });
    }
    return dbFail('design.preview.failed', error, { projectId, objectId: designId });
  }
  revalidateDesign(access, designId);
  return ok({ id });
}

/** 비교 이미지 보관 */
export async function archiveDesignPreview(raw: unknown): Promise<ActionResult> {
  const parsed = designPreviewArchiveSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { projectId, designId, id } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('design_previews')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('design_id', designId)
    .eq('project_id', projectId) // B-13: 다른 프로젝트 경로로 보관하지 않는다
    .is('archived_at', null)
    .select('id')
    .maybeSingle();
  if (error) return dbFail('design.preview.archive_failed', error, { projectId, objectId: id });
  if (!data) return fail('NOT_FOUND');
  revalidateDesign(access, designId);
  return ok(undefined);
}

/** D-27: 대표 도안 지정 (같은 프로젝트의 기존 대표는 내려간다 — set_main_design RPC) */
export async function setMainDesign(raw: unknown): Promise<ActionResult<null>> {
  const parsed = designMainSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { projectId, id } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  const supabase = await createServerSupabase();
  const { data: design } = await lockedDesign(supabase, projectId, id);
  if (!design) return fail('NOT_FOUND');
  if (design.archived_at) return fail('CONFLICT');
  const { error } = await supabase.rpc('set_main_design', { p_design: id });
  if (error) return dbFail('design.main.failed', error, { projectId, objectId: id });
  revalidateDesign(access, id);
  return ok(null);
}

/** D-28: 목록에서 한 칸 위·아래로 (보관되지 않은 도안의 현재 순서를 기준으로 바꿔 저장) */
/** 보관되지 않은 도안을 목록과 같은 순서로 읽어 공간별로 묶는다 */
async function loadOrderGroups(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  projectId: string,
) {
  const { data, error } = await supabase
    .from('designs')
    .select('id, space, is_main')
    .eq('project_id', projectId)
    .is('archived_at', null)
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false });
  if (error) return { error };
  return {
    groups: groupBySpace(
      (data ?? []).map((r) => ({ id: r.id, space: r.space, isMain: r.is_main })),
    ),
  };
}

/** D-28 도안 한 칸 이동 — 같은 공간 안에서만 */
export async function moveDesign(raw: unknown): Promise<ActionResult<null>> {
  const parsed = designMoveSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { projectId, id, direction } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  const supabase = await createServerSupabase();
  const loaded = await loadOrderGroups(supabase, projectId);
  if (loaded.error) return dbFail('design.move.list_failed', loaded.error, { projectId });
  const ids = moveWithinSpace(loaded.groups, id, direction);
  if (ids === 'missing') return fail('NOT_FOUND');
  if (ids === 'edge') return ok(null); // 이미 공간의 맨 위·맨 아래
  const { error } = await supabase.rpc('reorder_designs', { p_project: projectId, p_ids: ids });
  if (error) return dbFail('design.move.failed', error, { projectId, objectId: id });
  revalidateDesign(access);
  return ok(null);
}

/** D-28 공간 순서 한 칸 이동 — 그 공간 도안 묶음을 통째로 옮긴다 (고객 화면 공간 순서도 같이 바뀜) */
export async function moveDesignSpace(raw: unknown): Promise<ActionResult<null>> {
  const parsed = designSpaceMoveSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { projectId, space, direction } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  const supabase = await createServerSupabase();
  const loaded = await loadOrderGroups(supabase, projectId);
  if (loaded.error) return dbFail('design.move_space.list_failed', loaded.error, { projectId });
  const ids = moveSpace(loaded.groups, space, direction);
  if (ids === 'missing') return fail('NOT_FOUND');
  if (ids === 'edge') return ok(null);
  const { error } = await supabase.rpc('reorder_designs', { p_project: projectId, p_ids: ids });
  if (error) return dbFail('design.move_space.failed', error, { projectId });
  revalidateDesign(access);
  return ok(null);
}

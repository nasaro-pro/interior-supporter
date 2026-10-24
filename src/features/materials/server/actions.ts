'use server';
// 자재 Server Actions (REQ-111·113) — 03 문서 5.1 표준 형태
// 시스템 컬럼(company_id·created_by·version·confirm_state·revision)은 보내지 않는다 (DB 가 강제)
import { revalidatePath } from 'next/cache';
import { requireProjectAccess } from '@/features/core';
import { fail, ok, type ActionResult } from '@/shared/contracts/errors';
import type { ProjectAccess } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { dbFail, explainNoRow, invalid } from '@/features/designs/server/result';
import {
  materialArchiveSchema,
  materialCreateSchema,
  materialPublishSchema,
  materialUpdateSchema,
  type MaterialFields,
} from '@/features/materials/schema';

function toDbColumns(f: MaterialFields) {
  return {
    name: f.name,
    category: f.category,
    space: f.space,
    spec: f.spec,
    quantity: f.quantity,
    unit: f.unit,
    unit_price: f.unitPrice,
    image_file_id: f.imageFileId,
    location_note: f.locationNote,
    description: f.description,
  };
}

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

/** 0행 update 원인 구분용 재조회 (B-08) */
function lockedMaterial(supabase: Supabase, projectId: string, id: string) {
  return supabase
    .from('materials')
    .select('version, archived_at')
    .eq('id', id)
    .eq('project_id', projectId)
    .maybeSingle();
}

function revalidateMaterial(access: ProjectAccess, id?: string) {
  const { companySlug: c, projectId: p } = access;
  revalidatePath(routes.app.project(c, p, 'materials'));
  revalidatePath(routes.portal.project(p, 'materials'));
  if (id) {
    revalidatePath(routes.app.material(c, p, id));
    revalidatePath(routes.portal.material(p, id));
  }
}

export async function createMaterial(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = materialCreateSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { projectId, id, isPublic, ...fields } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return fail('UNAUTHENTICATED');
  const { error } = await supabase.from('materials').insert({
    id,
    // company_id·created_by 는 DB 트리거(scope·a_defaults)가 덮어쓴다. NOT NULL 이라 타입상 값을 보낸다 — PATCH_LOG P1-B-03
    company_id: access.companyId,
    created_by: user.user.id,
    project_id: projectId,
    is_public: isPublic,
    ...toDbColumns(fields),
  });
  if (error) {
    // POL-038: 같은 id 재시도 → 이미 저장된 행을 성공으로 반환
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('materials')
        .select('id')
        .eq('id', id)
        .eq('project_id', projectId)
        .maybeSingle();
      if (existing) return ok({ id });
    }
    return dbFail('material.create.failed', error, { projectId });
  }
  revalidateMaterial(access, id);
  return ok({ id });
}

/** 수정 후 목록·상세 즉시 일치 (TR-04). 핵심 필드 변경 → DB 가 revision+1·재확인 필요 (POL-012) */
export async function updateMaterial(
  raw: unknown,
): Promise<ActionResult<{ version: number; reconfirm: boolean }>> {
  const parsed = materialUpdateSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { projectId, id, baseVersion, ...fields } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  const supabase = await createServerSupabase();
  const { data: before } = await supabase
    .from('materials')
    .select('confirm_state, archived_at')
    .eq('id', id)
    .eq('project_id', projectId)
    .maybeSingle();
  if (!before) return fail('NOT_FOUND');
  // B-06: 보관된 자재는 수정하지 않는다 (핵심 필드 변경 시 확정 무효화까지 일어나므로 특히 막아야 함)
  if (before.archived_at) return fail('CONFLICT');
  const { data, error } = await supabase
    .from('materials')
    .update(toDbColumns(fields))
    .eq('id', id)
    .eq('project_id', projectId)
    .eq('version', baseVersion)
    .is('archived_at', null)
    .select('version, confirm_state')
    .maybeSingle();
  if (error) return dbFail('material.update.failed', error, { projectId, objectId: id });
  if (!data)
    return explainNoRow(lockedMaterial(supabase, projectId, id), baseVersion, {
      rejectArchived: true,
      msg: 'material.update.recheck_failed',
      fields: { projectId, objectId: id },
    });
  revalidateMaterial(access, id);
  return ok({
    version: data.version,
    reconfirm: before.confirm_state === 'confirmed' && data.confirm_state === 'needs_reconfirm',
  });
}

/** REQ-113: 공개 토글 (공개는 확정이 아님, 공개 시 고객 알림은 DB 트리거) */
export async function setMaterialPublic(raw: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = materialPublishSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { projectId, id, baseVersion, isPublic } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('materials')
    .update({ is_public: isPublic })
    .eq('id', id)
    .eq('project_id', projectId)
    .eq('version', baseVersion)
    .is('archived_at', null) // B-06: 보관 중에는 공개 전환 불가 (복원 후)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('material.publish.failed', error, { projectId, objectId: id });
  if (!data)
    return explainNoRow(lockedMaterial(supabase, projectId, id), baseVersion, {
      rejectArchived: true,
      msg: 'material.publish.recheck_failed',
      fields: { projectId, objectId: id },
    });
  revalidateMaterial(access, id);
  return ok({ version: data.version });
}

export async function setMaterialArchived(
  raw: unknown,
): Promise<ActionResult<{ version: number }>> {
  const parsed = materialArchiveSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { projectId, id, baseVersion, archived } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('materials')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id)
    .eq('project_id', projectId)
    .eq('version', baseVersion)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('material.archive.failed', error, { projectId, objectId: id });
  if (!data)
    return explainNoRow(lockedMaterial(supabase, projectId, id), baseVersion, {
      rejectArchived: false,
      msg: 'material.archive.recheck_failed',
      fields: { projectId, objectId: id },
    });
  revalidateMaterial(access, id);
  return ok({ version: data.version });
}

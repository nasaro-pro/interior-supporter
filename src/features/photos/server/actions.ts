'use server';
// photos Server Actions — 03 문서 5.1 표준 형태. 파일 연결은 DB attach_file 이 검사 (THR-008)
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
import {
  photoArchiveSchema,
  photoCreateSchema,
  photoUpdateSchema,
  photoVisibilitySchema,
} from '../schema';

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

/**
 * 조건부 update 가 0행일 때 원인 구분 (C-04): 없음·볼 수 없음 → NOT_FOUND(존재 숨김),
 * 보관됨 → CONFLICT, 시공팀의 남의 사진 → FORBIDDEN, 그 밖 → VERSION_CONFLICT
 */
async function zeroRowFailure(
  supabase: Supabase,
  projectId: string,
  photoId: string,
  fieldUserId: string | null,
): Promise<ActionResult<never>> {
  const { data } = await supabase
    .from('photos')
    .select('uploaded_by, archived_at')
    .eq('id', photoId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (data && !data.archived_at && fieldUserId !== null && data.uploaded_by !== fieldUserId) {
    return fail('FORBIDDEN');
  }
  return explainZeroRow(data);
}

function revalidatePhotos(access: ProjectAccess, photoId?: string) {
  const { companySlug, projectId } = access;
  revalidatePath(routes.app.project(companySlug, projectId, 'photos'));
  revalidatePath(routes.portal.project(projectId, 'photos'));
  revalidatePath(routes.field.photos());
  if (photoId) {
    revalidatePath(routes.app.photo(companySlug, projectId, photoId));
    revalidatePath(routes.portal.photo(projectId, photoId));
  }
}

/**
 * REQ-211·REQ-221: finalize 된 파일을 사진 행에 연결. 행 id 는 클라이언트 생성(POL-038).
 * 업로더·역할·시공팀 비공개는 DB 트리거(photo_before_insert)가 강제하고 앱도 같은 값을 보낸다.
 */
export async function createPhoto(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = photoCreateSchema.safeParse(raw);
  if (!parsed.success) return validationFail(parsed.error);
  const input = parsed.data;
  const access = await requireProjectAccess(input.projectId, ['editor', 'field']);
  const ctx = await getAccessContext();
  const isEditor = access.as === 'editor';
  const supabase = await createServerSupabase();
  const { error } = await supabase.from('photos').insert({
    id: input.id,
    project_id: input.projectId,
    company_id: access.companyId,
    file_id: input.fileId,
    thumb_file_id: input.thumbFileId,
    phase: input.phase,
    captured_on: input.capturedOn,
    description: input.description,
    is_public: isEditor && input.isPublic, // POL-017: 시공팀 업로드는 비공개
    uploaded_by: ctx.userId,
    uploader_role: isEditor ? 'staff' : 'field',
  });
  if (error) {
    if (error.code === '23505') {
      const { data } = await supabase.from('photos').select('id').eq('id', input.id).maybeSingle();
      if (data) {
        revalidatePhotos(access);
        return ok({ id: input.id });
      }
    }
    return dbFail('photo.create.failed', error, { projectId: input.projectId, objectId: input.id });
  }
  revalidatePhotos(access);
  return ok({ id: input.id });
}

/** REQ-213 / REQ-222: 공정·촬영일·설명 수정. 시공팀은 본인 사진만 (POL-005) */
export async function updatePhoto(raw: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = photoUpdateSchema.safeParse(raw);
  if (!parsed.success) return validationFail(parsed.error);
  const { projectId, photoId, baseVersion, phase, capturedOn, description } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor', 'field']);
  const supabase = await createServerSupabase();
  let fieldUserId: string | null = null;
  if (access.as === 'field') {
    fieldUserId = (await getAccessContext()).userId;
    const { data: own } = await supabase
      .from('photos')
      .select('uploaded_by, archived_at')
      .eq('id', photoId)
      .eq('project_id', projectId)
      .maybeSingle();
    if (!own) return fail('NOT_FOUND');
    if (own.uploaded_by !== fieldUserId) return fail('FORBIDDEN');
    if (own.archived_at) return fail('CONFLICT'); // C-04
  }
  let query = supabase
    .from('photos')
    .update({ phase, captured_on: capturedOn, description })
    .eq('id', photoId)
    .eq('project_id', projectId)
    .eq('version', baseVersion)
    .is('archived_at', null); // C-04: 보관 사진은 수정 불가 (서버 강제)
  // C-06: 확인과 갱신 사이 소유가 바뀌어도(TOCTOU) 본인 사진만 갱신되도록 update 자체에 조건
  if (fieldUserId !== null) query = query.eq('uploaded_by', fieldUserId);
  const { data, error } = await query.select('version').maybeSingle();
  if (error) return dbFail('photo.update.failed', error, { projectId, objectId: photoId });
  if (!data) return zeroRowFailure(supabase, projectId, photoId, fieldUserId);
  revalidatePhotos(access, photoId);
  return ok({ version: data.version });
}

/** REQ-213: 공개 전환은 편집자만 (POL-017). 업로드 ≠ 공개 승인 */
export async function setPhotoPublic(raw: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = photoVisibilitySchema.safeParse(raw);
  if (!parsed.success) return validationFail(parsed.error);
  const { projectId, photoId, baseVersion, isPublic } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('photos')
    .update({ is_public: isPublic })
    .eq('id', photoId)
    .eq('project_id', projectId)
    .eq('version', baseVersion)
    .is('archived_at', null) // C-04: 보관 사진은 공개 전환 불가 (복원 먼저)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('photo.visibility.failed', error, { projectId, objectId: photoId });
  if (!data) return zeroRowFailure(supabase, projectId, photoId, null);
  revalidatePhotos(access, photoId);
  return ok({ version: data.version });
}

/** POL-020: 보관·복원 (편집자) */
export async function setPhotoArchived(raw: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = photoArchiveSchema.safeParse(raw);
  if (!parsed.success) return validationFail(parsed.error);
  const { projectId, photoId, baseVersion, archived } = parsed.data;
  const access = await requireProjectAccess(projectId, ['editor']);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('photos')
    .update({ archived_at: archived ? nowIso() : null })
    .eq('id', photoId)
    .eq('project_id', projectId)
    .eq('version', baseVersion)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('photo.archive.failed', error, { projectId, objectId: photoId });
  if (!data) return fail('VERSION_CONFLICT');
  revalidatePhotos(access, photoId);
  return ok({ version: data.version });
}

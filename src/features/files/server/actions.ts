'use server';
// 공통 파일 어댑터 (B 제공, A·C 사용) — 계약: integration.ts 5장 FilesApi, 03 문서 3.3
// 시그니처·반환 형태·오류 코드를 바꾸지 않는다 (A·C 가 같은 시그니처의 STUB 으로 개발 중).
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getAccessContext, requireProjectAccess } from '@/features/core';
import { FILE_KINDS } from '@/shared/contracts/domain';
import { fail, mapDbError, ok, type ActionResult } from '@/shared/contracts/errors';
import type {
  FinalizedFile,
  UploadIntent,
  UploadIntentInput,
} from '@/shared/contracts/integration';
import { logger, newRef } from '@/shared/lib/logger';
import { createAdminSupabase } from '@/shared/lib/supabase/admin';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { checkNameAndSize, extOf, storagePath } from '@/features/files/lib/rules';
import { inspectAndNormalize } from '@/features/files/server/process';

const BUCKET = 'project-files' as const;
/** 업체 로고를 올릴 수 있는 업체 역할 (files_insert RLS: is_company_manager) */
const LOGO_ROLES: readonly string[] = ['owner', 'manager'];
/** finalize 선점(finalized_at 센티널)이 이 시간보다 오래되면 중단된 처리로 보고 다시 선점할 수 있다
 *  ('use server' 파일은 async 함수만 export 할 수 있으므로 내보내지 않는다) */
const FINALIZE_CLAIM_STALE_MS = 5 * 60_000;

const uploadIntentSchema = z.object({
  kind: z.enum(FILE_KINDS).exclude(['photo_thumb']),
  projectId: z.uuid().nullable(),
  companyId: z.uuid(),
  fileName: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  mime: z.string().max(255),
});

/** IF-upload-intent: 권한·규격 1차 검사 → files 행(pending) → 서명 업로드 URL (2시간 유효) */
export async function createUploadIntent(
  input: UploadIntentInput,
): Promise<ActionResult<UploadIntent>> {
  const parsed = uploadIntentSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION_FAILED', { fieldErrors: z.flattenError(parsed.error).fieldErrors });
  }
  const { kind, projectId, companyId, fileName, sizeBytes, mime } = parsed.data;

  // 1차: 앱 검사 (2차는 files_insert RLS 가 종류별로 다시 검사)
  const ctx = await getAccessContext();
  if (kind === 'company_logo') {
    if (projectId !== null) return fail('VALIDATION_FAILED');
    const m = ctx.memberships.find((x) => x.companyId === companyId);
    // B-16: 허용목록 방식 (새 역할이 생겨도 기본 거부)
    if (!m || !LOGO_ROLES.includes(m.role)) return fail('FORBIDDEN');
  } else {
    if (!projectId) return fail('VALIDATION_FAILED');
    const access = await requireProjectAccess(
      projectId,
      kind === 'photo_original' ? ['editor', 'field'] : ['editor'],
    );
    if (access.companyId !== companyId) return fail('FORBIDDEN');
  }

  const rejected = checkNameAndSize(kind, fileName, sizeBytes);
  if (rejected === 'type') return fail('FILE_TYPE_REJECTED');
  if (rejected === 'size') return fail('FILE_TOO_LARGE');

  const fileId = randomUUID();
  const path = storagePath(companyId, projectId, kind, fileId, extOf(fileName));
  const supabase = await createServerSupabase();
  const { error } = await supabase.from('files').insert({
    id: fileId,
    company_id: companyId,
    project_id: projectId,
    kind,
    bucket: BUCKET,
    path,
    original_name: fileName,
    mime: mime || 'application/octet-stream',
    size_bytes: sizeBytes,
    uploaded_by: ctx.userId,
    status: 'pending',
  });
  if (error) {
    const ref = newRef();
    logger.warn('file.intent.insert_failed', {
      ref,
      dbCode: error.code,
      projectId: projectId ?? undefined,
      userId: ctx.userId,
    });
    return fail(mapDbError(error), { ref });
  }

  const admin = createAdminSupabase();
  const { data, error: signError } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (signError || !data) {
    const ref = newRef();
    logger.error('file.intent.sign_failed', { ref, objectId: fileId, userId: ctx.userId });
    return fail('INTERNAL', { ref });
  }
  return ok({ fileId, bucket: BUCKET, path, token: data.token });
}

const fileIdSchema = z.uuid();

type Admin = ReturnType<typeof createAdminSupabase>;
interface FileRow {
  id: string;
  company_id: string;
  project_id: string | null;
  kind: (typeof FILE_KINDS)[number];
  bucket: string;
  path: string;
  original_name: string;
  status: 'pending' | 'ready' | 'rejected';
  reject_reason: string | null;
  width: number | null;
  height: number | null;
  uploaded_by: string;
}
const ROW_COLUMNS =
  'id, company_id, project_id, kind, bucket, path, original_name, status, reject_reason, width, height, uploaded_by';

/**
 * IF-upload-finalize: 실제 바이트 검사(형식 헤더·크기·디코딩) → 이미지 재인코딩(EXIF 제거) → ready/rejected
 *
 * B-02 동시 실행·재시도 규칙
 * - 선점: `finalized_at` 을 센티널로 쓴다. status='pending' 이고 finalized_at 이 비었을(또는 오래된 선점일) 때만
 *   원자적 update 로 선점한다. 선점 못 하면 저장된 결과(이미 ready/rejected) 또는 FILE_NOT_READY(처리 중).
 * - 실패 경로는 모두 선점을 풀어(finalized_at=null) 다시 시도할 수 있게 한다. status 는 pending 에서만 바꾼다
 *   (DB: 20261013000120 immutable_column:status).
 * - 썸네일은 derived_from 으로 기존 행을 먼저 찾아 재사용한다 (재시도 시 중복 생성 없음).
 *   이번 호출이 올린 썸네일 객체는 행 저장에 실패하면 지운다.
 */
export async function finalizeUpload(fileId: string): Promise<ActionResult<FinalizedFile>> {
  if (!fileIdSchema.safeParse(fileId).success) return fail('VALIDATION_FAILED');
  const started = Date.now();
  const ctx = await getAccessContext();

  // 사용자 권한으로 행 확인 (00 헌법 9.3: admin 사용 전 사용자 권한 확인)
  const supabase = await createServerSupabase();
  const { data: row, error } = await supabase
    .from('files')
    .select(ROW_COLUMNS)
    .eq('id', fileId)
    .maybeSingle();
  if (error) {
    const ref = newRef();
    logger.warn('file.finalize.select_failed', { ref, dbCode: error.code, objectId: fileId });
    return fail(mapDbError(error), { ref });
  }
  if (!row || row.uploaded_by !== ctx.userId || row.kind === 'photo_thumb')
    return fail('NOT_FOUND');

  const admin = createAdminSupabase();

  // 재시도(같은 파일 두 번 finalize)는 저장된 결과를 그대로 돌려준다
  if (row.status !== 'pending') return storedResult(admin, row as FileRow);

  // 원자적 선점 — 동시에 두 번 불려도 한 번만 처리한다
  const claimedAt = new Date().toISOString();
  const staleBefore = new Date(Date.now() - FINALIZE_CLAIM_STALE_MS).toISOString();
  const { data: claimed, error: claimError } = await admin
    .from('files')
    .update({ finalized_at: claimedAt })
    .eq('id', row.id)
    .eq('status', 'pending')
    .or(`finalized_at.is.null,finalized_at.lt."${staleBefore}"`)
    .select('id');
  if (claimError) {
    const ref = newRef();
    logger.error('file.finalize.claim_failed', { ref, objectId: row.id, dbCode: claimError.code });
    return fail('INTERNAL', { ref });
  }
  if (!claimed?.length) return currentResult(admin, row.id);

  let finished = false;
  try {
    const res = await processClaimed(admin, row as FileRow, claimedAt, started);
    finished = res.ok;
    return res;
  } catch (e) {
    const ref = newRef();
    logger.error('file.finalize.unexpected', {
      ref,
      objectId: row.id,
      code: e instanceof Error ? e.name : 'unknown',
    });
    return fail('INTERNAL', { ref });
  } finally {
    // 실패하면 선점을 푼다 (내 선점일 때만 — 이미 ready/rejected 가 됐으면 조건에 걸리지 않는다)
    if (!finished) await releaseClaim(admin, row.id, claimedAt);
  }
}

async function processClaimed(
  admin: Admin,
  row: FileRow,
  claimedAt: string,
  started: number,
): Promise<ActionResult<FinalizedFile>> {
  const { data: blob, error: dlError } = await admin.storage.from(row.bucket).download(row.path);
  if (dlError || !blob) {
    // 객체가 아직 없다 = 브라우저 업로드가 끝나지 않음
    return fail('FILE_NOT_READY');
  }
  const original = Buffer.from(await blob.arrayBuffer());
  const result = await inspectAndNormalize(row.kind, row.original_name, original);

  if (result.status === 'rejected') {
    const { data: done, error: rejectError } = await admin
      .from('files')
      .update({
        status: 'rejected',
        reject_reason: result.reason,
        finalized_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('status', 'pending')
      .eq('finalized_at', claimedAt)
      .select('id');
    if (rejectError) {
      const ref = newRef();
      logger.error('file.finalize.reject_failed', {
        ref,
        objectId: row.id,
        dbCode: rejectError.code,
      });
      return fail('INTERNAL', { ref });
    }
    if (!done?.length) return currentResult(admin, row.id);
    logger.info('file.finalize.rejected', {
      objectId: row.id,
      code: result.reason,
      durationMs: Date.now() - started,
    });
    return ok({ fileId: row.id, status: 'rejected', rejectReason: result.reason });
  }

  // 이미지: 메타데이터를 지운 재인코딩본으로 같은 경로를 덮어쓴다 (POL-022)
  if (result.reencoded) {
    const { error: upError } = await admin.storage
      .from(row.bucket)
      .upload(row.path, result.bytes, { contentType: result.mime, upsert: true });
    if (upError) {
      const ref = newRef();
      logger.error('file.finalize.overwrite_failed', { ref, objectId: row.id });
      return fail('INTERNAL', { ref });
    }
  }

  let thumbFileId: string | undefined;
  if (row.kind === 'photo_original' && result.thumb) {
    const existing = await findThumb(admin, row.id);
    if (existing.error) {
      const ref = newRef();
      logger.error('file.finalize.thumb_lookup_failed', { ref, objectId: row.id });
      return fail('INTERNAL', { ref });
    }
    if (existing.id) {
      thumbFileId = existing.id; // 재시도: 앞선 시도가 만든 썸네일을 그대로 쓴다
    } else {
      const newId = randomUUID();
      const thumbPath = storagePath(row.company_id, row.project_id, 'photo_thumb', newId, '.webp');
      const { error: thumbUpError } = await admin.storage
        .from(row.bucket)
        .upload(thumbPath, result.thumb.bytes, { contentType: 'image/webp', upsert: false });
      if (thumbUpError) {
        const ref = newRef();
        logger.error('file.finalize.thumb_upload_failed', { ref, objectId: row.id });
        return fail('INTERNAL', { ref });
      }
      const { error: thumbRowError } = await admin.from('files').insert({
        id: newId,
        company_id: row.company_id,
        project_id: row.project_id,
        kind: 'photo_thumb',
        bucket: row.bucket,
        path: thumbPath,
        original_name: row.original_name.replace(/\.[^.]+$/, '') + '.webp',
        mime: 'image/webp',
        size_bytes: result.thumb.bytes.length,
        sha256: sha256(result.thumb.bytes),
        status: 'ready',
        width: result.thumb.width,
        height: result.thumb.height,
        derived_from: row.id,
        uploaded_by: row.uploaded_by,
        finalized_at: new Date().toISOString(),
      });
      if (thumbRowError) {
        // 방금 올린 객체는 행이 없어 고아가 된다 → 지운다 (B-15 일부)
        await admin.storage.from(row.bucket).remove([thumbPath]);
        const ref = newRef();
        logger.error('file.finalize.thumb_failed', {
          ref,
          objectId: row.id,
          dbCode: thumbRowError.code,
        });
        return fail('INTERNAL', { ref });
      }
      thumbFileId = newId;
    }
  }

  const { data: ready, error: readyError } = await admin
    .from('files')
    .update({
      status: 'ready',
      mime: result.mime,
      size_bytes: result.bytes.length,
      sha256: sha256(result.bytes),
      width: result.width ?? null,
      height: result.height ?? null,
      finalized_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('status', 'pending')
    .eq('finalized_at', claimedAt)
    .select('id');
  if (readyError) {
    const ref = newRef();
    logger.error('file.finalize.ready_failed', { ref, objectId: row.id, dbCode: readyError.code });
    return fail('INTERNAL', { ref });
  }
  // 선점을 잃었다 (오래된 선점으로 판단돼 다른 요청이 가져감) → 현재 저장 상태 기준으로 응답
  if (!ready?.length) return currentResult(admin, row.id);
  logger.info('file.finalize.ready', { objectId: row.id, durationMs: Date.now() - started });
  return ok({
    fileId: row.id,
    status: 'ready',
    width: result.width,
    height: result.height,
    thumbFileId,
    capturedOn: result.capturedOn,
  });
}

/** 원본에서 파생된 썸네일 (가장 먼저 만든 것). 여러 행이어도 오류 없이 첫 행 */
async function findThumb(admin: Admin, fileId: string): Promise<{ id?: string; error?: true }> {
  const { data, error } = await admin
    .from('files')
    .select('id')
    .eq('derived_from', fileId)
    .eq('kind', 'photo_thumb')
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) return { error: true };
  return { id: data?.[0]?.id };
}

/** 이미 처리된 파일의 저장된 결과 */
async function storedResult(admin: Admin, row: FileRow): Promise<ActionResult<FinalizedFile>> {
  const thumb = row.kind === 'photo_original' ? await findThumb(admin, row.id) : {};
  return ok({
    fileId: row.id,
    status: row.status === 'rejected' ? 'rejected' : 'ready',
    rejectReason: (row.reject_reason ?? undefined) as FinalizedFile['rejectReason'],
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    thumbFileId: thumb.id,
  });
}

/** 선점하지 못한 호출: 끝났으면 저장된 결과, 아직 pending 이면 처리 중(FILE_NOT_READY) */
async function currentResult(admin: Admin, fileId: string): Promise<ActionResult<FinalizedFile>> {
  const { data, error } = await admin
    .from('files')
    .select(ROW_COLUMNS)
    .eq('id', fileId)
    .maybeSingle();
  if (error || !data) {
    const ref = newRef();
    logger.warn('file.finalize.reread_failed', { ref, objectId: fileId, dbCode: error?.code });
    return fail('INTERNAL', { ref });
  }
  if (data.status === 'pending') return fail('FILE_NOT_READY');
  return storedResult(admin, data as FileRow);
}

async function releaseClaim(admin: Admin, fileId: string, claimedAt: string) {
  const { error } = await admin
    .from('files')
    .update({ finalized_at: null })
    .eq('id', fileId)
    .eq('status', 'pending')
    .eq('finalized_at', claimedAt);
  if (error) {
    logger.warn('file.finalize.release_failed', {
      ref: newRef(),
      objectId: fileId,
      dbCode: error.code,
    });
  }
}

function sha256(buf: Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex');
}

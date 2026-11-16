// 공개용 사본 저장 — 원본(비공개 project-files)을 읽어 사본을 공개 버킷(portfolio-public)에 둔다.
// service_role 사용 파일 → eslint 허용 목록 추가 필요 (CR-PF-03). 호출 전 액션이 포트폴리오 단계(전체 관리 / 사례 올리기)를 확인한다. DB 쓰기는 사용자 권한(RLS)으로.
//
// 순서 (00 헌법 9.3: admin 을 쓰기 전에 사용자 권한으로 먼저 확인)
//   1) 사용자 클라이언트로 원본 files 행 조회 → RLS(can_view_file) 가 볼 수 있는 파일만 돌려준다
//   2) 사용자 클라이언트로 사례 조회 → 같은 업체의 보관 안 된 사례인지
//   3) admin 으로 원본 바이트 내려받기 → buildPublicVariants (메타데이터 제거·축소·WebP)
//   4) admin 으로 공개 버킷에 2장 올리기 (upsert 금지: 같은 경로 덮어쓰기 없음)
//   5) 사용자 클라이언트로 portfolio_images 행 저장 (RLS·트리거가 다시 검사)
//   실패하면 이번에 올린 객체를 지운다 → 행 없는 공개 객체가 남지 않는다
import 'server-only';
import { randomUUID } from 'node:crypto';
import { fail, ok, type ActionResult } from '@/shared/contracts/errors';
import { logger, newRef } from '@/shared/lib/logger';
import { dbFail } from '@/shared/lib/action';
import { createAdminSupabase } from '@/shared/lib/supabase/admin';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import {
  buildPublicVariants,
  publicLogoPath,
  publicPaths,
  type PublicVariant,
} from './public-variants';

export const PUBLIC_BUCKET = 'portfolio-public' as const;
/** 공개용 사본을 만들 수 있는 원본 종류 (이미지 결과물만. 도안 원본 CAD·PDF·견적은 안 됨) */
export const PUBLIC_SOURCE_KINDS = ['photo_original', 'design_preview', 'material_image'] as const;
const CACHE_ONE_YEAR = '31536000'; // 경로가 UUID 라 내용이 바뀌지 않는다

type Admin = ReturnType<typeof createAdminSupabase>;

export interface PublicCopyInput {
  companyId: string;
  workId: string;
  sourceFileId: string;
  space: string | null;
  spaceLabel: string;
  role: 'gallery' | 'before' | 'after';
  caption: string;
}

export interface PublicCopyResult {
  imageId: string;
  path: string;
  thumbPath: string;
  width: number;
  height: number;
}

async function upload(admin: Admin, path: string, v: PublicVariant) {
  return admin.storage.from(PUBLIC_BUCKET).upload(path, v.bytes, {
    contentType: 'image/webp',
    cacheControl: CACHE_ONE_YEAR,
    upsert: false,
  });
}

export async function removePublicObjects(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const { error } = await createAdminSupabase().storage.from(PUBLIC_BUCKET).remove(paths);
  if (error) logger.error('portfolio.public.remove_failed', { ref: newRef() });
}

/** 설정 › 포트폴리오에서 첨부한 전용 로고(이미 WebP 로 다시 만든 바이트)를 공개 버킷에 올린다. 실패하면 null */
export async function uploadCustomLogo(
  companyId: string,
  v: PublicVariant,
): Promise<string | null> {
  const logoPath = publicLogoPath(companyId, randomUUID());
  const up = await upload(createAdminSupabase(), logoPath, v);
  if (up.error) {
    logger.error('portfolio.custom_logo.upload_failed', { ref: newRef(), companyId });
    return null;
  }
  return logoPath;
}

async function readOriginal(admin: Admin, bucket: string, path: string): Promise<Buffer | null> {
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/** 원본 1장 → 공개용 사본 1세트(본·썸네일) + portfolio_images 행 */
export async function createPublicCopy(
  input: PublicCopyInput,
): Promise<ActionResult<PublicCopyResult>> {
  const supabase = await createServerSupabase();

  // 1) 원본 — RLS 가 볼 수 없는 파일은 null (존재 숨김: NOT_FOUND)
  const { data: file, error: fileError } = await supabase
    .from('files')
    .select('id, company_id, kind, bucket, path, status')
    .eq('id', input.sourceFileId)
    .maybeSingle();
  if (fileError) return dbFail('portfolio.copy.file_select_failed', fileError);
  if (!file || file.company_id !== input.companyId) return fail('NOT_FOUND');
  if (file.status !== 'ready') return fail('FILE_NOT_READY');
  if (!(PUBLIC_SOURCE_KINDS as readonly string[]).includes(file.kind)) {
    return fail('FILE_TYPE_REJECTED');
  }

  // 2) 사례
  const { data: work, error: workError } = await supabase
    .from('portfolio_works')
    .select('id')
    .eq('id', input.workId)
    .eq('company_id', input.companyId)
    .is('archived_at', null)
    .maybeSingle();
  if (workError) return dbFail('portfolio.copy.work_select_failed', workError);
  if (!work) return fail('NOT_FOUND');

  // 3) 원본 바이트 → 사본
  const admin = createAdminSupabase();
  const original = await readOriginal(admin, file.bucket, file.path);
  if (!original) {
    const ref = newRef();
    logger.error('portfolio.copy.download_failed', { ref, objectId: file.id });
    return fail('INTERNAL', { ref });
  }
  const variants = await buildPublicVariants(original);
  if (variants.status === 'rejected') return fail('FILE_CORRUPT');

  // 4) 공개 버킷에 올리기
  const imageId = randomUUID();
  const { path, thumbPath } = publicPaths(input.companyId, input.workId, imageId);
  const up1 = await upload(admin, path, variants.display);
  if (up1.error) {
    const ref = newRef();
    logger.error('portfolio.copy.upload_failed', { ref, objectId: imageId });
    return fail('INTERNAL', { ref });
  }
  const up2 = await upload(admin, thumbPath, variants.thumb);
  if (up2.error) {
    await removePublicObjects([path]);
    const ref = newRef();
    logger.error('portfolio.copy.upload_failed', { ref, objectId: imageId });
    return fail('INTERNAL', { ref });
  }

  // 5) 행 저장 (company_id 는 트리거 a_scope 가 사례에서 다시 복사)
  const { error: insertError } = await supabase.from('portfolio_images').insert({
    id: imageId,
    company_id: input.companyId,
    work_id: input.workId,
    source_file_id: file.id,
    path,
    thumb_path: thumbPath,
    width: variants.display.width,
    height: variants.display.height,
    thumb_width: variants.thumb.width,
    thumb_height: variants.thumb.height,
    space: input.space as never,
    space_label: input.spaceLabel,
    caption: input.caption,
    role: input.role,
  });
  if (insertError) {
    await removePublicObjects([path, thumbPath]);
    return dbFail('portfolio.copy.insert_failed', insertError, { objectId: imageId });
  }

  return ok({
    imageId,
    path,
    thumbPath,
    width: variants.display.width,
    height: variants.display.height,
  });
}

/** 업체 로고 → 공개용 사본 (공개 페이지 머리). 이전 사본 경로를 돌려주면 호출자가 지운다 */
export async function createPublicLogoCopy(
  companyId: string,
): Promise<ActionResult<{ logoPath: string | null }>> {
  const supabase = await createServerSupabase();
  const { data: company } = await supabase
    .from('companies')
    .select('logo_file_id')
    .eq('id', companyId)
    .maybeSingle();
  if (!company?.logo_file_id) return ok({ logoPath: null });

  const { data: file } = await supabase
    .from('files')
    .select('id, bucket, path, status, kind')
    .eq('id', company.logo_file_id)
    .maybeSingle();
  if (!file || file.status !== 'ready' || file.kind !== 'company_logo')
    return ok({ logoPath: null });

  const admin = createAdminSupabase();
  const original = await readOriginal(admin, file.bucket, file.path);
  if (!original) return fail('INTERNAL', { ref: newRef() });
  const v = await buildPublicVariants(original);
  if (v.status === 'rejected') return fail('FILE_CORRUPT');

  const logoPath = publicLogoPath(companyId, randomUUID());
  const up = await upload(admin, logoPath, v.thumb); // 로고는 640px 이면 충분
  if (up.error) {
    const ref = newRef();
    logger.error('portfolio.logo.upload_failed', { ref, companyId });
    return fail('INTERNAL', { ref });
  }
  return ok({ logoPath });
}

'use server';
// 공개 홈페이지 전용 로고 (설정 › 포트폴리오, 전체 관리 단계)
//  - 첨부: 휴대폰 사진처럼 큰 파일은 브라우저에서 먼저 줄여 보낸다 (서버 액션 본문 1MB 한도) → 여기서 다시 검사
//  - 받는 형식: PNG·JPG·WebP 만 (SVG 는 스크립트를 품을 수 있어 받지 않음). 메타데이터 지우고 긴 변 640px WebP 로 다시 만든다
//  - 공개 버킷 `{업체}/logo/{uuid}.webp` 에 새로 올리고(덮어쓰기 없음) 행을 바꾼 뒤 예전 전용 로고를 지운다
//  - 빼기: 전용 로고를 지우면 회사 정보 로고가 다시 보인다
import 'server-only';
import { revalidatePath } from 'next/cache';
import sharp from 'sharp';
import { fail, ok, type ActionResult } from '@/shared/contracts/errors';
import { dbFail, parseInput } from '@/shared/lib/action';
import { newRef } from '@/shared/lib/logger';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { LOGO_MAX_BYTES, LOGO_TYPES } from '../lib/logo';
import { portfolioRoutes } from '../routes';
import { companyRefSchema } from '../schema';
import { requirePortfolioLevel } from './access';
import { removePublicObjects, uploadCustomLogo } from './public-copy';
import { buildPublicVariants } from './public-variants';

function refresh(slug: string) {
  revalidatePath(portfolioRoutes.settings(slug));
  revalidatePath(portfolioRoutes.home(slug));
}

export async function uploadPortfolioLogo(
  form: FormData,
): Promise<ActionResult<{ logoPath: string }>> {
  const parsed = parseInput(companyRefSchema, { companyId: form.get('companyId') });
  if (!parsed.ok) return parsed.result;
  const { companyId } = parsed.data;
  const auth = await requirePortfolioLevel(companyId, 'full');
  if (!auth.ok) return auth.error;

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0)
    return fail('VALIDATION_FAILED', { fieldErrors: { file: ['field.required'] } });
  if (file.size > LOGO_MAX_BYTES) return fail('FILE_TOO_LARGE');
  const bytes = Buffer.from(await file.arrayBuffer());
  // 확장자·브라우저가 알려 준 형식은 믿지 않고 내용으로 확인
  let format: string | undefined;
  try {
    format = (await sharp(bytes, { limitInputPixels: false }).metadata()).format;
  } catch {
    return fail('FILE_CORRUPT');
  }
  if (!format || !(LOGO_TYPES as readonly string[]).includes(format))
    return fail('FILE_TYPE_REJECTED');
  const v = await buildPublicVariants(bytes);
  if (v.status === 'rejected')
    return fail(v.reason === 'pixels' ? 'FILE_TOO_LARGE' : 'FILE_CORRUPT');

  const supabase = await createServerSupabase();
  const { data: current } = await supabase
    .from('company_portfolios')
    .select('custom_logo_path')
    .eq('company_id', companyId)
    .maybeSingle();

  // 공개 버킷 올리기는 service_role 허용 파일(public-copy.ts)에서만 (TC-909)
  const logoPath = await uploadCustomLogo(companyId, v.thumb);
  if (!logoPath) return fail('INTERNAL', { ref: newRef() });

  // 행 쓰기는 사용자 권한(RLS·트리거: 자기 업체 폴더만). 아직 설정을 저장한 적 없으면 행을 만든다
  const { error } = current
    ? await supabase
        .from('company_portfolios')
        .update({ custom_logo_path: logoPath })
        .eq('company_id', companyId)
    : await supabase
        .from('company_portfolios')
        .insert({ company_id: companyId, custom_logo_path: logoPath });
  if (error) {
    await removePublicObjects([logoPath]);
    return dbFail('portfolio.custom_logo.save_failed', error, { companyId });
  }
  if (current?.custom_logo_path) await removePublicObjects([current.custom_logo_path]);
  refresh(auth.a.slug);
  return ok({ logoPath });
}

export async function removePortfolioLogo(raw: unknown): Promise<ActionResult<void>> {
  const parsed = parseInput(companyRefSchema, raw);
  if (!parsed.ok) return parsed.result;
  const { companyId } = parsed.data;
  const auth = await requirePortfolioLevel(companyId, 'full');
  if (!auth.ok) return auth.error;
  const supabase = await createServerSupabase();
  const { data: current } = await supabase
    .from('company_portfolios')
    .select('custom_logo_path')
    .eq('company_id', companyId)
    .maybeSingle();
  if (!current?.custom_logo_path) return ok(undefined);
  const { error } = await supabase
    .from('company_portfolios')
    .update({ custom_logo_path: null })
    .eq('company_id', companyId);
  if (error) return dbFail('portfolio.custom_logo.remove_failed', error, { companyId });
  await removePublicObjects([current.custom_logo_path]);
  refresh(auth.a.slug);
  return ok(undefined);
}

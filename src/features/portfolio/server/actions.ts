'use server';
// 포트폴리오 관리 (PM-65 제안) — 쓰기는 권한 단계대로 (lib/access.ts · RLS private.portfolio_can_edit_work)
// 공개 순서: 사례 만들기 → 사진 고르기(공개용 사본) → 고객 동의 기록 → 공개
import { revalidatePath } from 'next/cache';
import type { TablesUpdate } from '@/shared/contracts/database.types';
import { fail, ok, type ActionResult } from '@/shared/contracts/errors';
import { dbFail, parseInput } from '@/shared/lib/action';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import {
  addImagesSchema,
  consentSchema,
  createWorkSchema,
  weeksBetween,
  imageRefSchema,
  updateImageSchema,
  portfolioSettingsSchema,
  updateWorkSchema,
  workRefSchema,
  workStatusSchema,
} from '../schema';
import { FEATURED_LIMIT_DEFAULT } from '../lib/grid';
import { portfolioRoutes } from '../routes';
import { createPublicCopy, createPublicLogoCopy, removePublicObjects } from './public-copy';
import { requirePortfolioLevel } from './access';

/**
 * 단계 확인 — full: 대표·관리자·'전체 관리' 담당자 / works: '사례 올리기' 담당자 (자기 담당 프로젝트의 초안만, RLS·트리거가 다시 막음)
 * 반환 모양은 예전 managerOf 와 같다 (auth.m.slug)
 */
async function managerOf(companyId: string, need: 'works' | 'full' = 'full') {
  const r = await requirePortfolioLevel(companyId, need);
  if (!r.ok) return r;
  return { ok: true as const, m: { companyId: r.a.companyId, slug: r.a.slug }, a: r.a };
}

function refresh(slug: string, workId?: string) {
  revalidatePath(portfolioRoutes.settings(slug));
  revalidatePath(portfolioRoutes.home(slug));
  if (workId) revalidatePath(portfolioRoutes.work(slug, workId));
}

// ── 사례 ──────────────────────────────────────────────────────────────

export async function createWork(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = parseInput(createWorkSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const auth = await managerOf(v.companyId, 'works');
  if (!auth.ok) return auth.error;
  // '사례 올리기' 단계는 자기 담당 프로젝트에서만 (RLS 가 다시 막음)
  if (auth.a.level === 'works' && (!v.projectId || !auth.a.myProjectIds.has(v.projectId))) {
    return fail('VALIDATION_FAILED', { fieldErrors: { projectId: ['field.portfolioOwnProject'] } });
  }
  const supabase = await createServerSupabase();
  // 1) 공사 기간을 비웠으면 원본 프로젝트 기간(시작~끝)으로 채운다
  let durationWeeks = v.durationWeeks;
  if (durationWeeks === null && v.projectId) {
    const { data: project } = await supabase
      .from('projects')
      .select('start_date, end_date')
      .eq('id', v.projectId)
      .eq('company_id', v.companyId)
      .maybeSingle();
    durationWeeks = weeksBetween(project?.start_date ?? null, project?.end_date ?? null);
  }
  const { error } = await supabase.from('portfolio_works').insert({
    id: v.id,
    company_id: v.companyId,
    project_id: v.projectId,
    title: v.title,
    area_label: v.areaLabel,
    size_pyeong: v.sizePyeong,
    spaces: v.spaces,
    completed_on: v.completedOn,
    duration_weeks: durationWeeks,
    summary: v.summary,
  });
  if (error) return dbFail('portfolio.work.create_failed', error, { companyId: v.companyId });
  refresh(auth.m.slug);
  return ok({ id: v.id });
}

export async function updateWork(raw: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = parseInput(updateWorkSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const auth = await managerOf(v.companyId, 'works');
  if (!auth.ok) return auth.error;
  // 대표 지정·순서는 전체 관리만 (트리거 check_level 이 다시 막음)
  if (auth.a.level !== 'full' && (v.isFeatured !== undefined || v.sortOrder !== undefined))
    return fail('FORBIDDEN');
  const patch: TablesUpdate<'portfolio_works'> = {};
  if (v.title !== undefined) patch.title = v.title;
  if (v.areaLabel !== undefined) patch.area_label = v.areaLabel;
  if (v.sizePyeong !== undefined) patch.size_pyeong = v.sizePyeong;
  if (v.spaces !== undefined) patch.spaces = v.spaces;
  if (v.completedOn !== undefined) patch.completed_on = v.completedOn;
  if (v.durationWeeks !== undefined) patch.duration_weeks = v.durationWeeks;
  if (v.isFeatured !== undefined) patch.is_featured = v.isFeatured;
  if (v.summary !== undefined) patch.summary = v.summary;
  if (v.coverImageId !== undefined) patch.cover_image_id = v.coverImageId;
  if (v.sortOrder !== undefined) patch.sort_order = v.sortOrder;
  const supabase = await createServerSupabase();
  // 4) 대표 사례는 업체가 정한 수까지 — 넘으면 어느 칸이 문제인지 알려 준다 (DB 트리거 featured_limit 가 다시 막음)
  if (v.isFeatured) {
    const { data: settings } = await supabase
      .from('company_portfolios')
      .select('featured_limit')
      .eq('company_id', v.companyId)
      .maybeSingle();
    const limit = settings?.featured_limit ?? FEATURED_LIMIT_DEFAULT;
    const { count } = await supabase
      .from('portfolio_works')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', v.companyId)
      .eq('is_featured', true)
      .is('archived_at', null)
      .neq('id', v.workId);
    if ((count ?? 0) >= limit) {
      return fail('CONFLICT', { fieldErrors: { isFeatured: ['field.featuredLimit'] } });
    }
  }
  const { data, error } = await supabase
    .from('portfolio_works')
    .update(patch)
    .eq('id', v.workId)
    .eq('company_id', v.companyId)
    .eq('version', v.baseVersion)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('portfolio.work.update_failed', error, { objectId: v.workId });
  if (!data) return fail('VERSION_CONFLICT');
  refresh(auth.m.slug, v.workId);
  return ok({ version: data.version });
}

/** 고객 동의 기록 — 누가(서버가 auth.uid 로 강제)·언제·어떻게 받았는지 */
export async function recordConsent(raw: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = parseInput(consentSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const auth = await managerOf(v.companyId, 'works');
  if (!auth.ok) return auth.error;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('portfolio_works')
    .update({ consent_at: new Date().toISOString(), consent_note: v.note })
    .eq('id', v.workId)
    .eq('company_id', v.companyId)
    .eq('version', v.baseVersion)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('portfolio.consent.failed', error, { objectId: v.workId });
  if (!data) return fail('VERSION_CONFLICT');
  refresh(auth.m.slug, v.workId);
  return ok({ version: data.version });
}

/** 공개·비공개 — 공개는 동의 기록이 있어야 한다 (DB check portfolio_works_publish_consent 가 다시 막음) */
export async function setWorkStatus(raw: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = parseInput(workStatusSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const auth = await managerOf(v.companyId);
  if (!auth.ok) return auth.error;
  const supabase = await createServerSupabase();
  if (v.status === 'published') {
    const { data: w } = await supabase
      .from('portfolio_works')
      .select('consent_at, cover_image_id')
      .eq('id', v.workId)
      .maybeSingle();
    if (!w) return fail('NOT_FOUND');
    if (!w.consent_at) {
      return fail('VALIDATION_FAILED', { fieldErrors: { consent: ['field.consentRequired'] } });
    }
    if (!w.cover_image_id) {
      return fail('VALIDATION_FAILED', { fieldErrors: { cover: ['field.coverRequired'] } });
    }
  }
  const { data, error } = await supabase
    .from('portfolio_works')
    .update({ status: v.status })
    .eq('id', v.workId)
    .eq('company_id', v.companyId)
    .eq('version', v.baseVersion)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('portfolio.work.status_failed', error, { objectId: v.workId });
  if (!data) return fail('VERSION_CONFLICT');
  refresh(auth.m.slug, v.workId);
  return ok({ version: data.version });
}

/**
 * 동의 철회 — 비공개로 돌리고, 공개용 사본을 모두 보관 + 공개 버킷에서 지운다.
 * (원본 사진·도안은 그대로. DB 행은 보관만 하고 지우지 않는다: POL-020)
 */
export async function withdrawConsent(raw: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = parseInput(workRefSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const auth = await managerOf(v.companyId, 'works');
  if (!auth.ok) return auth.error;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('portfolio_works')
    .update({ status: 'draft', consent_at: null, consent_note: null, cover_image_id: null })
    .eq('id', v.workId)
    .eq('company_id', v.companyId)
    .eq('version', v.baseVersion)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('portfolio.consent.withdraw_failed', error, { objectId: v.workId });
  if (!data) return fail('VERSION_CONFLICT');

  const { data: images, error: imgError } = await supabase
    .from('portfolio_images')
    .update({ archived_at: new Date().toISOString() })
    .eq('work_id', v.workId)
    .is('archived_at', null)
    .select('path, thumb_path');
  if (imgError)
    return dbFail('portfolio.consent.archive_images_failed', imgError, { objectId: v.workId });
  await removePublicObjects((images ?? []).flatMap((i) => [i.path, i.thumb_path]));
  refresh(auth.m.slug, v.workId);
  return ok({ version: data.version });
}

// ── 사진 (공개용 사본) ─────────────────────────────────────────────────

export type AddImageOutcome =
  | { sourceFileId: string; ok: true; imageId: string }
  | { sourceFileId: string; ok: false; code: string };

/** 여러 장을 한 번에 — 성공분은 남기고 실패분만 돌려준다 (업로드 큐와 같은 규칙) */
export async function addPortfolioImages(
  raw: unknown,
): Promise<ActionResult<{ results: AddImageOutcome[] }>> {
  const parsed = parseInput(addImagesSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const auth = await managerOf(v.companyId, 'works');
  if (!auth.ok) return auth.error;
  const results: AddImageOutcome[] = [];
  // 512MB 서버 메모리를 고려해 한 장씩 처리
  for (const item of v.items) {
    const r = await createPublicCopy({ companyId: v.companyId, workId: v.workId, ...item });
    results.push(
      r.ok
        ? { sourceFileId: item.sourceFileId, ok: true, imageId: r.data.imageId }
        : { sourceFileId: item.sourceFileId, ok: false, code: r.error.code },
    );
  }
  refresh(auth.m.slug, v.workId);
  return ok({ results });
}

export async function archivePortfolioImage(raw: unknown): Promise<ActionResult<void>> {
  const parsed = parseInput(imageRefSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const auth = await managerOf(v.companyId, 'works');
  if (!auth.ok) return auth.error;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('portfolio_images')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', v.imageId)
    .eq('company_id', v.companyId)
    .eq('version', v.baseVersion)
    .select('work_id, path, thumb_path')
    .maybeSingle();
  if (error) return dbFail('portfolio.image.archive_failed', error, { objectId: v.imageId });
  if (!data) return fail('VERSION_CONFLICT');
  // 대표 사진이었다면 대표를 비운다 (공개 중인 사례는 공개 RPC 가 보관된 대표를 내보내지 않음)
  await supabase
    .from('portfolio_works')
    .update({ cover_image_id: null })
    .eq('id', data.work_id)
    .eq('cover_image_id', v.imageId);
  await removePublicObjects([data.path, data.thumb_path]);
  refresh(auth.m.slug, data.work_id);
  return ok(undefined);
}

/**
 * 사진 하나 고치기 — 공간·공간 이름·설명·역할. 비포/애프터는 사례마다 한 장이라
 * 새로 정하면 같은 역할의 다른 사진을 먼저 '일반'으로 돌린다 (DB 유니크 인덱스 portfolio_images_pair_uq)
 */
export async function updatePortfolioImage(
  raw: unknown,
): Promise<ActionResult<{ version: number }>> {
  const parsed = parseInput(updateImageSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const auth = await managerOf(v.companyId, 'works');
  if (!auth.ok) return auth.error;
  const supabase = await createServerSupabase();
  const patch: TablesUpdate<'portfolio_images'> = {};
  if (v.space !== undefined) patch.space = v.space;
  if (v.spaceLabel !== undefined) patch.space_label = v.spaceLabel;
  if (v.caption !== undefined) patch.caption = v.caption;
  if (v.role !== undefined) patch.role = v.role;
  if (v.role === 'before' || v.role === 'after') {
    const { data: me } = await supabase
      .from('portfolio_images')
      .select('work_id')
      .eq('id', v.imageId)
      .eq('company_id', v.companyId)
      .maybeSingle();
    if (!me) return fail('NOT_FOUND');
    const { error: clearError } = await supabase
      .from('portfolio_images')
      .update({ role: 'gallery' })
      .eq('work_id', me.work_id)
      .eq('role', v.role)
      .is('archived_at', null)
      .neq('id', v.imageId);
    if (clearError)
      return dbFail('portfolio.image.role_clear_failed', clearError, { objectId: v.imageId });
  }
  const { data, error } = await supabase
    .from('portfolio_images')
    .update(patch)
    .eq('id', v.imageId)
    .eq('company_id', v.companyId)
    .eq('version', v.baseVersion)
    .select('version, work_id')
    .maybeSingle();
  if (error) return dbFail('portfolio.image.update_failed', error, { objectId: v.imageId });
  if (!data) return fail('VERSION_CONFLICT');
  // 비포 사진은 대표로 쓰지 않는다 — 대표였다면 대표를 비운다 (화면이 다시 고르게 안내)
  if (v.role === 'before') {
    await supabase
      .from('portfolio_works')
      .update({ cover_image_id: null })
      .eq('id', data.work_id)
      .eq('cover_image_id', v.imageId);
  }
  refresh(auth.m.slug, data.work_id);
  return ok({ version: data.version });
}

// ── 공개 페이지 설정 ───────────────────────────────────────────────────

export async function updatePortfolioSettings(
  raw: unknown,
): Promise<ActionResult<{ version: number }>> {
  const parsed = parseInput(portfolioSettingsSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const auth = await managerOf(v.companyId);
  if (!auth.ok) return auth.error;
  const supabase = await createServerSupabase();

  const { data: current } = await supabase
    .from('company_portfolios')
    .select('logo_path, version, business_locked_at')
    .eq('company_id', v.companyId)
    .maybeSingle();

  // 켤 때마다 로고 사본을 새로 만든다 (업체 정보에서 로고를 바꿨을 수 있음)
  let logoPath = current?.logo_path ?? null;
  if (v.isPublic) {
    const logo = await createPublicLogoCopy(v.companyId);
    if (!logo.ok) return logo;
    logoPath = logo.data.logoPath;
  }
  const fields = {
    is_public: v.isPublic,
    intro: v.intro,
    contact_phone: v.contactPhone,
    contact_url: v.contactUrl,
    page_tone: v.pageTone,
    logo_path: logoPath,
    business_name: v.businessName,
    representative: v.representative,
    business_reg_no: v.businessRegNo,
    address: v.address,
    cs_hours: v.csHours,
    featured_limit: v.featuredLimit,
    footer_slogan: v.footerSlogan,
    contact_email: v.contactEmail,
    mail_order_no: v.mailOrderNo,
    sns_links: v.snsLinks,
    footer_tone: v.footerTone,
    works_layout: v.worksLayout,
    gallery_filter: v.galleryFilter,
    carousel_per: v.carouselPer,
    title_font: v.titleFont,
    body_font: v.bodyFont,
    title_weight: v.titleWeight,
    mobile_works_layout: v.mobileWorksLayout,
    mobile_gallery_cols: v.mobileGalleryCols,
    page_labels: v.pageLabels,
    logo_hidden: v.logoHidden,
  };
  // 사이트 관리자가 잠근 대표자·사업자등록번호는 보내지 않는다 (DB 트리거 business_locked 가 다시 막음)
  const saveFields: Partial<typeof fields> = { ...fields };
  if (current?.business_locked_at) {
    delete saveFields.representative;
    delete saveFields.business_reg_no;
  }

  let version: number;
  if (!current) {
    const { data, error } = await supabase
      .from('company_portfolios')
      .insert({ company_id: v.companyId, ...fields })
      .select('version')
      .single();
    if (error) {
      if (logoPath) await removePublicObjects([logoPath]);
      return dbFail('portfolio.settings.insert_failed', error, { companyId: v.companyId });
    }
    version = data.version;
  } else {
    const { data, error } = await supabase
      .from('company_portfolios')
      .update(saveFields)
      .eq('company_id', v.companyId)
      .eq('version', v.baseVersion ?? -1)
      .select('version')
      .maybeSingle();
    if (error || !data) {
      if (logoPath && logoPath !== current.logo_path) await removePublicObjects([logoPath]);
      return error
        ? dbFail('portfolio.settings.update_failed', error, { companyId: v.companyId })
        : fail('VERSION_CONFLICT');
    }
    version = data.version;
  }
  if (current?.logo_path && current.logo_path !== logoPath) {
    await removePublicObjects([current.logo_path]);
  }
  refresh(auth.m.slug);
  return ok({ version });
}

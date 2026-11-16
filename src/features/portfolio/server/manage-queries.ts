// 포트폴리오 관리 탭(PM-65) 조회 — 직원 권한(RLS is_company_staff). 대표·관리자만 화면을 연다(page 에서 확인)
import 'server-only';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import {
  clampFeaturedLimit,
  FEATURED_LIMIT_DEFAULT,
  normalizeCarouselPer,
  normalizeMobileCols,
  normalizeMobileLayout,
  normalizeWorksLayout,
  type WorksLayout,
} from '../lib/grid';
import type { ManageWork } from '../lib/manage';
import { cleanLabels, type PageLabels } from '../lib/labels';
import {
  normalizeBodyFont,
  normalizeFooterTone,
  normalizePortfolioTone,
  type PortfolioTone,
  normalizeTitleFont,
  normalizeTitleWeight,
  type BodyFont,
  type FooterTone,
  type TitleFont,
  type TitleWeight,
} from '../brand';

export interface ManageSettings {
  version: number | null; // 아직 저장한 적 없으면 null
  isPublic: boolean;
  intro: string;
  contactPhone: string | null;
  contactUrl: string | null;
  pageTone: PortfolioTone;
  featuredLimit: number;
  businessName: string;
  representative: string;
  businessRegNo: string | null;
  /** 사이트 관리자가 대표자·사업자등록번호를 잠갔는지 (잠기면 읽기 전용) */
  businessLocked: boolean;
  address: string;
  csHours: string;
  // 바닥 칸
  footerSlogan: string;
  contactEmail: string | null;
  mailOrderNo: string | null;
  snsLinks: string[];
  footerTone: FooterTone;
  // 시공 사례 배열
  worksLayout: WorksLayout;
  galleryFilter: boolean;
  carouselPer: 3 | 4;
  // 글꼴 · 휴대폰 따로
  titleFont: TitleFont;
  bodyFont: BodyFont;
  titleWeight: TitleWeight;
  mobileWorksLayout: WorksLayout | null;
  mobileGalleryCols: 1 | 2;
  // 홈페이지 이름(사이트 관리자만 바꿈 — 여기서는 보기만) · 작은 문구 · 로고
  siteName: string | null;
  companyName: string;
  labels: PageLabels;
  /** 홈페이지 전용 로고 (공개 버킷 경로) */
  customLogoPath: string | null;
  /** 회사 정보 로고 사본 (전용 로고가 없을 때 보임) */
  companyLogoPath: string | null;
  /** 로고 숨기기 (이름만) */
  logoHidden: boolean;
}

export interface ManageProject {
  id: string;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

/** editableOf: 사례마다 '고칠 수 있나' (권한 단계·담당 프로젝트·상태로 page 가 정해 넘긴다) */
export async function getPortfolioManage(
  companyId: string,
  editableOf: (w: { status: 'draft' | 'published'; projectId: string | null }) => boolean = () =>
    true,
) {
  const supabase = await createServerSupabase();
  const [{ data: company }, { data: p }, { data: works }, { data: projects }] = await Promise.all([
    supabase.from('companies').select('slug, name').eq('id', companyId).maybeSingle(),
    supabase.from('company_portfolios').select('*').eq('company_id', companyId).maybeSingle(),
    supabase
      .from('portfolio_works')
      .select(
        'id, version, project_id, title, area_label, size_pyeong, duration_weeks, completed_on, status, consent_at, is_featured, cover_image_id, sort_order',
      )
      .eq('company_id', companyId)
      .is('archived_at', null)
      .order('sort_order')
      .order('created_at', { ascending: false }),
    supabase
      .from('projects')
      .select('id, name, status, start_date, end_date')
      .eq('company_id', companyId)
      .is('archived_at', null)
      .order('end_date', { ascending: false, nullsFirst: false }),
  ]);
  if (!company) return null;

  const rows = works ?? [];
  const ids = rows.map((w) => w.id);
  const { data: imgs } = ids.length
    ? await supabase
        .from('portfolio_images')
        .select('id, work_id, thumb_path')
        .in('work_id', ids)
        .is('archived_at', null)
    : { data: [] as { id: string; work_id: string; thumb_path: string }[] };
  const thumbById = new Map((imgs ?? []).map((i) => [i.id, i.thumb_path]));
  const countByWork = new Map<string, number>();
  for (const i of imgs ?? []) countByWork.set(i.work_id, (countByWork.get(i.work_id) ?? 0) + 1);

  const settings: ManageSettings = {
    version: p?.version ?? null,
    isPublic: p?.is_public ?? false,
    intro: p?.intro ?? '',
    contactPhone: p?.contact_phone ?? null,
    contactUrl: p?.contact_url ?? null,
    pageTone: normalizePortfolioTone(p?.page_tone ?? 'default'),
    featuredLimit: clampFeaturedLimit(p?.featured_limit ?? FEATURED_LIMIT_DEFAULT),
    businessName: p?.business_name ?? '',
    representative: p?.representative ?? '',
    businessRegNo: p?.business_reg_no ?? null,
    businessLocked: !!p?.business_locked_at,
    address: p?.address ?? '',
    csHours: p?.cs_hours ?? '',
    footerSlogan: p?.footer_slogan ?? '',
    contactEmail: p?.contact_email ?? null,
    mailOrderNo: p?.mail_order_no ?? null,
    snsLinks: Array.isArray(p?.sns_links)
      ? (p.sns_links as unknown[]).filter((x): x is string => typeof x === 'string')
      : [],
    footerTone: normalizeFooterTone(p?.footer_tone),
    worksLayout: normalizeWorksLayout(p?.works_layout),
    galleryFilter: p?.gallery_filter ?? true,
    carouselPer: normalizeCarouselPer(p?.carousel_per),
    titleFont: normalizeTitleFont(p?.title_font),
    bodyFont: normalizeBodyFont(p?.body_font),
    titleWeight: normalizeTitleWeight(p?.title_weight),
    mobileWorksLayout: normalizeMobileLayout(p?.mobile_works_layout),
    mobileGalleryCols: normalizeMobileCols(p?.mobile_gallery_cols),
    siteName: p?.site_name?.trim() || null,
    companyName: company.name,
    labels: cleanLabels(p?.page_labels),
    customLogoPath: p?.custom_logo_path ?? null,
    companyLogoPath: p?.logo_path ?? null,
    logoHidden: p?.logo_hidden ?? false,
  };

  const list: ManageWork[] = rows.map((w) => ({
    id: w.id,
    version: w.version,
    projectId: w.project_id,
    editable: editableOf({ status: w.status, projectId: w.project_id }),
    title: w.title,
    areaLabel: w.area_label,
    sizePyeong: w.size_pyeong === null ? null : Number(w.size_pyeong),
    durationWeeks: w.duration_weeks,
    completedOn: w.completed_on,
    status: w.status,
    hasConsent: !!w.consent_at,
    isFeatured: w.is_featured,
    coverThumbPath: w.cover_image_id ? (thumbById.get(w.cover_image_id) ?? null) : null,
    photoCount: countByWork.get(w.id) ?? 0,
    sortOrder: w.sort_order,
  }));

  const projectList: ManageProject[] = (projects ?? []).map((x) => ({
    id: x.id,
    name: x.name,
    status: x.status,
    startDate: x.start_date,
    endDate: x.end_date,
  }));

  return {
    slug: String(company.slug),
    name: company.name,
    settings,
    works: list,
    projects: projectList,
  };
}

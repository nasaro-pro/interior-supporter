// 관리자 미리보기 조회 — 직원 권한(RLS: is_company_staff)으로 표를 직접 읽어 공개 화면과 같은 모양으로 만든다.
// 공개 RPC 와 달리 비공개(초안) 사례·공개 꺼짐 상태에서도 보인다. 화면에 '미리보기' 띠를 반드시 함께 그린다.
import 'server-only';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import {
  clampFeaturedLimit,
  FEATURED_LIMIT_DEFAULT,
  type PublicWorkCard,
  type PublicWorkImage,
  normalizeCarouselPer,
  normalizeMobileCols,
  normalizeMobileLayout,
  normalizeWorksLayout,
} from '../lib/grid';
import type { PortfolioCompany, PublicWorkDetail } from '../lib/parse';
import type { PortfolioSpace } from '../schema';
import {
  normalizeBodyFont,
  normalizeFooterTone,
  normalizePortfolioTone,
  normalizeTitleFont,
  normalizeTitleWeight,
} from '../brand';
import { cleanLabels } from '../lib/labels';
import { cleanSnsList } from '../lib/sns';

export type PreviewWorkCard = PublicWorkCard & {
  status: 'draft' | 'published';
  hasConsent: boolean;
};

const WORK_COLS =
  'id, title, area_label, size_pyeong, spaces, completed_on, duration_weeks, is_featured, cover_image_id, status, consent_at, summary';
const IMG_COLS =
  'id, path, thumb_path, width, height, thumb_width, thumb_height, space, space_label, caption, role';

type WorkRow = {
  id: string;
  title: string;
  area_label: string;
  size_pyeong: number | null;
  spaces: string[];
  completed_on: string | null;
  duration_weeks: number | null;
  is_featured: boolean;
  cover_image_id: string | null;
  status: 'draft' | 'published';
  consent_at: string | null;
  summary: string;
};
type ImgRow = {
  id: string;
  path: string;
  thumb_path: string;
  width: number;
  height: number;
  thumb_width: number;
  thumb_height: number;
  space: string | null;
  space_label: string;
  caption: string;
  role: 'gallery' | 'before' | 'after';
};

const toImage = (i: ImgRow): PublicWorkImage => ({
  id: i.id,
  path: i.path,
  thumbPath: i.thumb_path,
  width: i.width,
  height: i.height,
  thumbWidth: i.thumb_width,
  thumbHeight: i.thumb_height,
  space: (i.space as PortfolioSpace | null) ?? null,
  spaceLabel: i.space_label,
  caption: i.caption,
  role: i.role,
});

async function loadCompany(
  companyId: string,
): Promise<{ company: PortfolioCompany; isPublic: boolean } | null> {
  const supabase = await createServerSupabase();
  const [{ data: c }, { data: p }] = await Promise.all([
    supabase.from('companies').select('slug, name').eq('id', companyId).maybeSingle(),
    supabase
      .from('company_portfolios')
      .select(
        'is_public, intro, contact_phone, contact_url, contact_email, page_tone, logo_path, business_name, representative, business_reg_no, mail_order_no, address, cs_hours, featured_limit, footer_slogan, footer_tone, sns_links, works_layout, gallery_filter, carousel_per, title_font, body_font, title_weight, site_name, page_labels, custom_logo_path, logo_hidden, mobile_works_layout, mobile_gallery_cols',
      )
      .eq('company_id', companyId)
      .maybeSingle(),
  ]);
  if (!c) return null;
  return {
    isPublic: p?.is_public ?? false,
    company: {
      slug: String(c.slug),
      name: p?.site_name?.trim() || c.name,
      siteName: p?.site_name?.trim() || null,
      labels: cleanLabels(p?.page_labels),
      intro: p?.intro ?? '',
      contactPhone: p?.contact_phone ?? null,
      contactUrl: p?.contact_url ?? null,
      pageTone: normalizePortfolioTone(p?.page_tone),
      logoPath: p?.logo_hidden ? null : (p?.custom_logo_path ?? p?.logo_path ?? null),
      logoHidden: p?.logo_hidden ?? false,
      businessName: p?.business_name ?? '',
      representative: p?.representative ?? '',
      businessRegNo: p?.business_reg_no ?? null,
      address: p?.address ?? '',
      csHours: p?.cs_hours ?? '',
      featuredLimit: clampFeaturedLimit(p?.featured_limit ?? FEATURED_LIMIT_DEFAULT),
      contactEmail: p?.contact_email ?? null,
      mailOrderNo: p?.mail_order_no ?? null,
      footerSlogan: p?.footer_slogan ?? '',
      footerTone: normalizeFooterTone(p?.footer_tone),
      worksLayout: normalizeWorksLayout(p?.works_layout),
      galleryFilter: p?.gallery_filter ?? true,
      carouselPer: normalizeCarouselPer(p?.carousel_per),
      titleFont: normalizeTitleFont(p?.title_font),
      bodyFont: normalizeBodyFont(p?.body_font),
      titleWeight: normalizeTitleWeight(p?.title_weight),
      mobileWorksLayout: normalizeMobileLayout(p?.mobile_works_layout),
      mobileGalleryCols: normalizeMobileCols(p?.mobile_gallery_cols),
      snsLinks: cleanSnsList(
        Array.isArray(p?.sns_links)
          ? (p.sns_links as unknown[]).filter((x): x is string => typeof x === 'string')
          : [],
      ),
    },
  };
}

export async function getPortfolioPreview(companyId: string) {
  const head = await loadCompany(companyId);
  if (!head) return null;
  const supabase = await createServerSupabase();
  const { data: works } = await supabase
    .from('portfolio_works')
    .select(WORK_COLS)
    .eq('company_id', companyId)
    .is('archived_at', null)
    .order('is_featured', { ascending: false })
    .order('sort_order')
    .order('completed_on', { ascending: false, nullsFirst: false });
  const rows = (works ?? []) as WorkRow[];
  const coverIds = rows.map((w) => w.cover_image_id).filter((x): x is string => !!x);
  const { data: covers } = coverIds.length
    ? await supabase
        .from('portfolio_images')
        .select(IMG_COLS)
        .in('id', coverIds)
        .is('archived_at', null)
    : { data: [] as ImgRow[] };
  const coverById = new Map(((covers ?? []) as ImgRow[]).map((i) => [i.id, i]));
  const cards: PreviewWorkCard[] = rows.map((w) => {
    const cover = w.cover_image_id ? coverById.get(w.cover_image_id) : undefined;
    return {
      id: w.id,
      title: w.title,
      areaLabel: w.area_label,
      sizePyeong: w.size_pyeong === null ? null : Number(w.size_pyeong),
      spaces: w.spaces as PortfolioSpace[],
      completedOn: w.completed_on,
      durationWeeks: w.duration_weeks,
      isFeatured: w.is_featured && !!cover,
      cover: cover
        ? {
            path: cover.path,
            thumbPath: cover.thumb_path,
            width: cover.width,
            height: cover.height,
            caption: cover.caption,
          }
        : null,
      status: w.status,
      hasConsent: !!w.consent_at,
    };
  });
  return { ...head, works: cards };
}

export async function getPortfolioPreviewWork(
  companyId: string,
  workId: string,
): Promise<(PublicWorkDetail & { status: 'draft' | 'published' }) | null> {
  const head = await loadCompany(companyId);
  if (!head) return null;
  const supabase = await createServerSupabase();
  const { data: w } = await supabase
    .from('portfolio_works')
    .select(WORK_COLS)
    .eq('id', workId)
    .eq('company_id', companyId)
    .is('archived_at', null)
    .maybeSingle();
  if (!w) return null;
  const row = w as WorkRow;
  const { data: imgs } = await supabase
    .from('portfolio_images')
    .select(IMG_COLS)
    .eq('work_id', workId)
    .is('archived_at', null)
    .order('sort_order')
    .order('created_at');
  return {
    id: row.id,
    title: row.title,
    areaLabel: row.area_label,
    sizePyeong: row.size_pyeong === null ? null : Number(row.size_pyeong),
    spaces: row.spaces as PortfolioSpace[],
    completedOn: row.completed_on,
    durationWeeks: row.duration_weeks,
    summary: row.summary,
    images: ((imgs ?? []) as ImgRow[]).map(toImage),
    company: head.company,
    status: row.status,
  };
}

/** 업체 관리 화면 위쪽 메뉴의 '내 홈페이지' 버튼용 — 공개 여부만 (직원 권한 RLS) */
export async function getPortfolioPublicState(companyId: string): Promise<boolean> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('company_portfolios')
    .select('is_public')
    .eq('company_id', companyId)
    .maybeSingle();
  return data?.is_public ?? false;
}

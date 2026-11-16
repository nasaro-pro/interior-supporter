-- =====================================================================
-- 20261108000700_a_portfolio_font_device.sql
-- 소유: A · 공개 페이지 글꼴 + 휴대폰 따로 설정
--  title_font : 제목(업체 이름·사례 이름·숫자)  serif(노토 세리프, 기본) / pretendard / noto_sans / system(기기 고딕)
--  body_font  : 본문                            pretendard(기본) / noto_sans / system
--  title_weight : 제목 굵기 400 가늘게 / 500 보통 / 600 굵게(기본). 사진 위 슬라이드 제목은 최소 500
--  mobile_works_layout : 휴대폰 사례 배열. null = PC 와 같게 (기본)
--  mobile_gallery_cols : 휴대폰 갤러리 칸 수 1 / 2 (기본 2)
--  글꼴은 PC·휴대폰 같음 (같은 업체가 기기마다 달라 보이지 않게)
-- =====================================================================

alter table public.company_portfolios
  add column title_font text not null default 'serif' check (title_font in ('serif', 'pretendard', 'noto_sans', 'system')),
  add column body_font text not null default 'pretendard' check (body_font in ('pretendard', 'noto_sans', 'system')),
  add column title_weight smallint not null default 600 check (title_weight in (400, 500, 600)),
  add column mobile_works_layout text check (mobile_works_layout is null or mobile_works_layout in ('gallery', 'carousel', 'list')),
  add column mobile_gallery_cols smallint not null default 2 check (mobile_gallery_cols in (1, 2));

create or replace function private.portfolio_company_json(p_company uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'slug', c.slug::text, 'name', c.name, 'intro', cp.intro,
    'contactPhone', cp.contact_phone, 'contactUrl', cp.contact_url, 'contactEmail', cp.contact_email,
    'pageTone', cp.page_tone, 'logoPath', cp.logo_path,
    'businessName', cp.business_name, 'representative', cp.representative,
    'businessRegNo', cp.business_reg_no, 'mailOrderNo', cp.mail_order_no,
    'address', cp.address, 'csHours', cp.cs_hours,
    'featuredLimit', cp.featured_limit,
    'footerSlogan', cp.footer_slogan, 'footerTone', cp.footer_tone, 'snsLinks', cp.sns_links,
    'worksLayout', cp.works_layout, 'galleryFilter', cp.gallery_filter, 'carouselPer', cp.carousel_per,
    'titleFont', cp.title_font, 'bodyFont', cp.body_font, 'titleWeight', cp.title_weight,
    'mobileWorksLayout', cp.mobile_works_layout, 'mobileGalleryCols', cp.mobile_gallery_cols)
  from public.companies c
  join public.company_portfolios cp on cp.company_id = c.id
  where c.id = p_company
$$;

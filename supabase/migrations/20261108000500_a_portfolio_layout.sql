-- =====================================================================
-- 20261108000500_a_portfolio_layout.sql
-- 소유: A · 공개 목록 '시공 사례' 배열 — 업체가 고른다
--  gallery  : C 갤러리 (세로 사진 격자) + 공간 필터 켜기/끄기
--  carousel : D 가로 넘김 (본문 폭 안에서 넘김) + PC 한 화면 3장/4장
--  list     : E 목록형 (넓은 사진 한 장씩 + 이름·평형|기간 한 줄)
-- 기본: gallery · 필터 켬 · 3장
-- =====================================================================

alter table public.company_portfolios
  add column works_layout text not null default 'gallery' check (works_layout in ('gallery', 'carousel', 'list')),
  add column gallery_filter boolean not null default true,
  add column carousel_per smallint not null default 3 check (carousel_per in (3, 4));

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
    'worksLayout', cp.works_layout, 'galleryFilter', cp.gallery_filter, 'carouselPer', cp.carousel_per)
  from public.companies c
  join public.company_portfolios cp on cp.company_id = c.id
  where c.id = p_company
$$;

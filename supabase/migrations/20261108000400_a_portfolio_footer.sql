-- =====================================================================
-- 20261108000400_a_portfolio_footer.sql
-- 소유: A · 공개 포트폴리오 바닥 칸 커스텀
--  - 바닥 문구, 상담 이메일, 통신판매업신고번호, SNS 주소(최대 5개, https), 바닥 색(분위기 색을 따라감: same/soft/deep)
--  - 공개 RPC 2개가 같은 업체 정보를 쓰도록 private.portfolio_company_json 하나로 모음
-- =====================================================================

/* SNS 주소 목록: 문자열 배열, 최대 5개, 모두 https:// 로 시작, 각 300자 이하 */
create function private.valid_sns_links(v jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(v) = 'array' and jsonb_array_length(v) <= 5
     and not exists (
       select 1 from jsonb_array_elements(v) e
        where jsonb_typeof(e) <> 'string' or (e #>> '{}') !~ '^https://[^\s]+$' or char_length(e #>> '{}') > 300)
$$;

alter table public.company_portfolios
  add column footer_slogan text not null default '' check (char_length(footer_slogan) <= 60),
  add column contact_email text check (contact_email is null
    or (contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(contact_email) <= 120)),
  add column mail_order_no text check (mail_order_no is null or char_length(mail_order_no) <= 40),
  add column sns_links jsonb not null default '[]'::jsonb check (private.valid_sns_links(sns_links)),
  add column footer_tone text not null default 'soft' check (footer_tone in ('same', 'soft', 'deep'));

/* 공개해도 되는 업체 정보 (목록·상세 RPC 공통). 공개 여부 확인은 부르는 쪽 RPC 가 한다 */
create function private.portfolio_company_json(p_company uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'slug', c.slug::text, 'name', c.name, 'intro', cp.intro,
    'contactPhone', cp.contact_phone, 'contactUrl', cp.contact_url, 'contactEmail', cp.contact_email,
    'pageTone', cp.page_tone, 'logoPath', cp.logo_path,
    'businessName', cp.business_name, 'representative', cp.representative,
    'businessRegNo', cp.business_reg_no, 'mailOrderNo', cp.mail_order_no,
    'address', cp.address, 'csHours', cp.cs_hours,
    'featuredLimit', cp.featured_limit,
    'footerSlogan', cp.footer_slogan, 'footerTone', cp.footer_tone, 'snsLinks', cp.sns_links)
  from public.companies c
  join public.company_portfolios cp on cp.company_id = c.id
  where c.id = p_company
$$;
revoke execute on function private.portfolio_company_json(uuid) from public, anon;

create or replace function public.get_public_portfolio(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'company', private.portfolio_company_json(c.id),
    'works', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', w.id, 'title', w.title, 'areaLabel', w.area_label,
               'sizePyeong', w.size_pyeong, 'spaces', to_jsonb(w.spaces),
               'completedOn', w.completed_on, 'durationWeeks', w.duration_weeks,
               -- 대표 표시는 대표 사진이 있는 것 중 정렬 앞쪽 featured_limit 개만 (수를 줄였을 때 넘치는 것은 일반 사례로)
               'isFeatured', w.id in (
                 select f.id from public.portfolio_works f
                  where f.company_id = c.id and f.status = 'published' and f.archived_at is null
                    and f.is_featured and f.cover_image_id is not null
                  order by f.sort_order, f.completed_on desc nulls last, f.id
                  limit cp.featured_limit),
               'cover', (select jsonb_build_object('path', i.path, 'thumbPath', i.thumb_path,
                                                   'width', i.width, 'height', i.height, 'caption', i.caption)
                           from public.portfolio_images i
                          where i.id = w.cover_image_id and i.archived_at is null))
             order by w.is_featured desc, w.sort_order, w.completed_on desc nulls last, w.id)
        from public.portfolio_works w
       where w.company_id = c.id and w.status = 'published' and w.archived_at is null), '[]'::jsonb))
  from public.companies c
  join public.company_portfolios cp on cp.company_id = c.id and cp.is_public
  -- search_path='' 에서는 citext 연산자를 못 찾아 대소문자를 구분하므로 소문자로 맞춰 비교 (slug 는 소문자만 허용)
  where c.slug::text = lower(btrim(p_slug))
$$;

create or replace function public.get_public_portfolio_work(p_slug text, p_work uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', w.id, 'title', w.title, 'areaLabel', w.area_label, 'sizePyeong', w.size_pyeong,
    'spaces', to_jsonb(w.spaces), 'completedOn', w.completed_on, 'durationWeeks', w.duration_weeks,
    'summary', w.summary,
    -- 상세 화면의 상담 띠·푸터를 한 번에 그리기 위한 업체 정보 (목록 RPC 와 같은 공개 항목만)
    'company', private.portfolio_company_json(c.id),
    'images', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id, 'path', i.path, 'thumbPath', i.thumb_path, 'width', i.width, 'height', i.height,
               'thumbWidth', i.thumb_width, 'thumbHeight', i.thumb_height,
               'space', i.space, 'spaceLabel', i.space_label, 'caption', i.caption, 'role', i.role)
             order by i.sort_order, i.created_at)
        from public.portfolio_images i
       where i.work_id = w.id and i.archived_at is null), '[]'::jsonb))
  from public.portfolio_works w
  join public.companies c on c.id = w.company_id
  join public.company_portfolios cp on cp.company_id = c.id and cp.is_public
  -- search_path='' 에서는 citext 연산자를 못 찾아 대소문자를 구분하므로 소문자로 맞춰 비교 (slug 는 소문자만 허용)
  where c.slug::text = lower(btrim(p_slug)) and w.id = p_work
    and w.status = 'published' and w.archived_at is null
$$;


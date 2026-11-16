-- =====================================================================
-- 20261108000900_a_portfolio_site_admin.sql
-- 소유: A · 공개 홈페이지 — 사이트 관리자 칸 + 업체가 고치는 문구·로고
--  1) site_name      : 홈페이지 이름 (큰 제목 + 왼쪽 위 이름). 사이트 관리자만 바꾼다. null = 업체 이름(companies.name)
--  2) page_labels    : 업체가 고치는 작은 문구 {introKicker, worksKicker, worksTitle, followUs, contact}
--                      값: 글자 = 직접 쓴 문구 / false = 숨김(worksTitle 은 숨길 수 없음) / 키 없음 = 기본 문구
--  3) custom_logo_path : 홈페이지 전용 로고(공개 버킷 사본). null = 회사 정보 로고 사본(logo_path) → 없으면 첫 글자
--     logo_hidden      : 로고 숨기기 — 로고 칸(첫 글자 포함)을 빼고 이름만 보인다
--  4) 사이트 관리자 RPC (관리자 콘솔 업체 상세 ADM-03 의 '공개 홈페이지' 칸)
--       admin_company_portfolio · admin_set_portfolio_site_name · admin_set_portfolio_business_lock
--     private.require_platform_admin() 으로 검사하고 private.admin_log 로 관리 기록을 남긴다 (사이트 관리 파트와 같은 방식)
--  5) 대표자·사업자등록번호 잠금(000600)도 이 RPC 로 사이트 관리자가 직접 잠그고 푼다
-- 관리 기록 action 3개 추가 → admin_audit_events CHECK 를 넓힌다 (사이트 관리 파트 표 · CR-PF-20)
-- =====================================================================

create function private.valid_page_labels(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object' and not exists (
    select 1 from jsonb_each(p) e
     where e.key not in ('introKicker', 'worksKicker', 'worksTitle', 'followUs', 'contact')
        or not (
          (jsonb_typeof(e.value) = 'string'
             and char_length(btrim(e.value #>> '{}')) between 1 and (case when e.key = 'worksTitle' then 20 else 30 end))
          or (e.value = 'false'::jsonb and e.key <> 'worksTitle')))
$$;

alter table public.company_portfolios
  add column site_name text check (site_name is null or char_length(btrim(site_name)) between 1 and 60),
  add column page_labels jsonb not null default '{}'::jsonb check (private.valid_page_labels(page_labels)),
  add column logo_hidden boolean not null default false,
  add column custom_logo_path text check (custom_logo_path is null or custom_logo_path ~ '^[0-9a-f-]{36}/logo/[0-9a-f-]{36}\.webp$');

-- 홈페이지 이름은 사이트 관리자(관리자 RPC = system_write) 만. 로고 사본 경로는 자기 업체 폴더만
create function private.portfolio_site_admin_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.custom_logo_path is not null and split_part(new.custom_logo_path, '/', 1) <> new.company_id::text then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if private.is_system_context() then return new; end if;
  if tg_op = 'INSERT' then
    new.site_name := null;
  elsif new.site_name is distinct from old.site_name then
    raise exception 'system_column:site_name' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger check_site_admin before insert or update on public.company_portfolios
  for each row execute function private.portfolio_site_admin_check();

-- 공개 RPC 가 쓰는 업체 정보: 홈페이지 이름 · 문구 · 로고(전용 로고 우선)
create or replace function private.portfolio_company_json(p_company uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'slug', c.slug::text, 'name', c.name, 'siteName', cp.site_name, 'intro', cp.intro,
    'contactPhone', cp.contact_phone, 'contactUrl', cp.contact_url, 'contactEmail', cp.contact_email,
    'pageTone', cp.page_tone,
    'logoPath', case when cp.logo_hidden then null else coalesce(cp.custom_logo_path, cp.logo_path) end,
    'logoHidden', cp.logo_hidden,
    'businessName', cp.business_name, 'representative', cp.representative,
    'businessRegNo', cp.business_reg_no, 'mailOrderNo', cp.mail_order_no,
    'address', cp.address, 'csHours', cp.cs_hours,
    'featuredLimit', cp.featured_limit,
    'footerSlogan', cp.footer_slogan, 'footerTone', cp.footer_tone, 'snsLinks', cp.sns_links,
    'worksLayout', cp.works_layout, 'galleryFilter', cp.gallery_filter, 'carouselPer', cp.carousel_per,
    'titleFont', cp.title_font, 'bodyFont', cp.body_font, 'titleWeight', cp.title_weight,
    'mobileWorksLayout', cp.mobile_works_layout, 'mobileGalleryCols', cp.mobile_gallery_cols,
    'labels', cp.page_labels)
  from public.companies c
  join public.company_portfolios cp on cp.company_id = c.id
  where c.id = p_company
$$;

-- ---------------------------------------------------------------------
-- 관리 기록 action 추가
-- ---------------------------------------------------------------------
alter table public.admin_audit_events drop constraint admin_audit_events_action_check;
alter table public.admin_audit_events add constraint admin_audit_events_action_check check (action in (
  'company_owner_changed', 'user_suspended', 'user_unsuspended', 'user_anonymized',
  'self_withdrawn', 'site_settings_updated', 'company_quota_updated',
  'files_purged', 'notifications_purged', 'password_reset_issued',
  'portfolio_site_name_changed', 'portfolio_business_locked', 'portfolio_business_unlocked'));

-- ---------------------------------------------------------------------
-- 사이트 관리자 RPC
-- ---------------------------------------------------------------------
-- 업체 상세의 '공개 홈페이지' 칸. 포트폴리오를 아직 안 만들었으면 null
create function public.admin_company_portfolio(p_company uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  perform private.require_platform_admin();
  select jsonb_build_object(
      'slug', c.slug::text, 'companyName', c.name, 'siteName', cp.site_name,
      'isPublic', cp.is_public,
      'publicWorks', (select count(*) from public.portfolio_works w
                       where w.company_id = c.id and w.status = 'published' and w.archived_at is null),
      'businessName', cp.business_name, 'representative', cp.representative,
      'businessRegNo', cp.business_reg_no, 'businessLockedAt', cp.business_locked_at)
    into v
    from public.companies c
    join public.company_portfolios cp on cp.company_id = c.id
   where c.id = p_company;
  return v;
end $$;

create function public.admin_set_portfolio_site_name(p_company uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_old text; v_new text := nullif(btrim(coalesce(p_name, '')), '');
begin
  perform private.require_platform_admin();
  select cp.site_name into v_old from public.company_portfolios cp where cp.company_id = p_company;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if v_old is not distinct from v_new then return; end if;
  perform set_config('app.system_write', 'on', true);
  update public.company_portfolios set site_name = v_new where company_id = p_company;
  perform set_config('app.system_write', 'off', true);
  perform private.admin_log('portfolio_site_name_changed', 'company', p_company,
    jsonb_build_object('from', v_old, 'to', v_new));
end $$;

create function public.admin_set_portfolio_business_lock(p_company uuid, p_locked boolean) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare v timestamptz;
begin
  perform private.require_platform_admin();
  perform set_config('app.system_write', 'on', true);
  v := private.set_portfolio_business_lock(p_company, p_locked);
  perform set_config('app.system_write', 'off', true);
  perform private.admin_log(case when p_locked then 'portfolio_business_locked' else 'portfolio_business_unlocked' end,
    'company', p_company, '{}'::jsonb);
  return v;
end $$;

revoke all on function private.valid_page_labels(jsonb), private.portfolio_site_admin_check() from public, anon;
grant execute on function private.valid_page_labels(jsonb) to authenticated, service_role;
revoke all on function public.admin_company_portfolio(uuid), public.admin_set_portfolio_site_name(uuid, text),
  public.admin_set_portfolio_business_lock(uuid, boolean) from public, anon;
grant execute on function public.admin_company_portfolio(uuid), public.admin_set_portfolio_site_name(uuid, text),
  public.admin_set_portfolio_business_lock(uuid, boolean) to authenticated;

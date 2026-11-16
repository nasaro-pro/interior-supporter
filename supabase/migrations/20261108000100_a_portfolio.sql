-- =====================================================================
-- 20261108000100_a_portfolio.sql
-- 소유: A(제안) · 관련: CR-PF-01 (portfolio-update/README.md)
-- 내용: 업체 포트폴리오 — 공개 페이지 설정 · 사례 · 공개용 사본 이미지
--   1) company_portfolios : 업체별 공개 페이지 설정 (공개 여부·소개·연락처·분위기·공개 로고 사본)
--   2) portfolio_works    : 사례 (원본 프로젝트 연결, 고객 동의 기록, 공개 상태)
--   3) portfolio_images   : 공개용 사본 (원본 files 는 그대로 두고, 줄이고 메타데이터를 지운 WebP 를 공개 버킷에 둔다)
--   4) 공개 버킷 portfolio-public (쓰기는 서버 service_role 만)
--   5) 공개 조회 RPC 2개 — 표에는 직원 정책만 두고, 외부 방문자는 안전한 열만 돌려주는 함수로만 읽는다
--   v2 (11-08): 공사 기간(주)·대표 사례·공간 이름(침실A 등)·푸터 사업자 정보
--   v3 (11-08): 대표 사례 수를 업체가 정함 (company_portfolios.featured_limit 1~6, 기본 3) = 공개 목록 슬라이드 장수
-- 원칙: DELETE 정책 없음(POL-020, 보관) · 공개(published)는 고객 동의가 있어야 함 · 원본 권한 체계는 건드리지 않음
-- =====================================================================

create type public.portfolio_status as enum ('draft', 'published');
create type public.portfolio_image_role as enum ('gallery', 'before', 'after');

-- ---------------------------------------------------------------------
-- 1. 업체별 공개 페이지 설정
-- ---------------------------------------------------------------------
create table public.company_portfolios (
  company_id      uuid primary key references public.companies(id),
  is_public       boolean not null default false,
  intro           text not null default '' check (char_length(intro) <= 300),
  contact_phone   text check (contact_phone is null or contact_phone ~ '^[0-9+() -]{7,20}$'),
  contact_url     text check (contact_url is null or (contact_url ~ '^https://' and char_length(contact_url) <= 300)),
  page_tone       text not null default 'ivory' check (private.valid_page_tone(page_tone)),
  -- 업체 로고의 공개용 사본 경로 (로고 원본은 비공개 버킷이라 외부에서 볼 수 없다)
  logo_path       text check (logo_path is null or logo_path ~ '^[0-9a-f-]{36}/logo/[0-9a-f-]{36}\.webp$'),
  -- 푸터 사업자 정보 (전자상거래법 표시 항목. 비우면 푸터에서 그 줄을 뺀다)
  business_name   text not null default '' check (char_length(business_name) <= 100),
  representative  text not null default '' check (char_length(representative) <= 50),
  business_reg_no text check (business_reg_no is null or business_reg_no ~ '^[0-9]{3}-[0-9]{2}-[0-9]{5}$'),
  address         text not null default '' check (char_length(address) <= 200),
  cs_hours        text not null default '' check (char_length(cs_hours) <= 60),
  -- 대표 사례 수 = 공개 목록 맨 위 사진 슬라이드 장수. 줄이면 정렬 순서 앞쪽만 보이고, 넘는 새 지정은 트리거가 막는다
  featured_limit  smallint not null default 3 check (featured_limit between 1 and 6),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  version         integer not null default 1
);
-- audit_row 는 a->>'id' 를 쓰므로 생성 컬럼 id (company_settings 와 같은 방식)
alter table public.company_portfolios add column id uuid generated always as (company_id) stored;

-- ---------------------------------------------------------------------
-- 2. 사례
-- ---------------------------------------------------------------------
create table public.portfolio_works (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id),
  project_id      uuid references public.projects(id),           -- 원본 프로젝트 (외부에 내보내지 않음)
  title           text not null check (char_length(title) between 1 and 80),
  area_label      text not null default '' check (char_length(area_label) <= 30),  -- "청담동" 까지만 (호수·번지 금지 — 화면 안내 + 아래 check)
  size_pyeong     numeric(5, 1) check (size_pyeong is null or size_pyeong > 0),
  spaces          public.material_space[] not null default '{}',
  completed_on    date,
  duration_weeks  smallint check (duration_weeks is null or duration_weeks between 1 and 104),
  is_featured     boolean not null default false,               -- 대표 사례 (업체가 정한 수까지, 트리거)
  summary         text not null default '' check (char_length(summary) <= 1000),
  cover_image_id  uuid,
  status          public.portfolio_status not null default 'draft',
  consent_at      timestamptz,
  consent_by      uuid references auth.users(id),
  consent_note    text check (consent_note is null or char_length(consent_note) <= 200),
  sort_order      integer not null default 0,
  created_by      uuid not null default auth.uid() references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  version         integer not null default 1,
  archived_at     timestamptz,
  -- 공개하려면 고객 동의 기록이 있어야 한다
  constraint portfolio_works_publish_consent check (status <> 'published' or consent_at is not null),
  -- 지역 표기에 번지·호수가 섞이지 않게 (숫자+호/번지/동 뒤 숫자 패턴 거절)
  constraint portfolio_works_area_coarse check (area_label !~ '[0-9]+\s*(호|번지|-)')
);
create index portfolio_works_company_idx on public.portfolio_works (company_id, sort_order);

-- ---------------------------------------------------------------------
-- 3. 공개용 사본 이미지
-- ---------------------------------------------------------------------
create table public.portfolio_images (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id),
  work_id         uuid not null references public.portfolio_works(id),
  source_file_id  uuid not null references public.files(id),     -- 어떤 원본에서 만들었는지 (외부에 내보내지 않음)
  path            text not null unique check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  thumb_path      text not null unique check (thumb_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}_t\.webp$'),
  width           integer not null check (width > 0),
  height          integer not null check (height > 0),
  thumb_width     integer not null check (thumb_width > 0),
  thumb_height    integer not null check (thumb_height > 0),
  space           public.material_space,
  space_label     text not null default '' check (char_length(space_label) <= 20),  -- 같은 공간이 여럿일 때 "침실A"·"욕실B"
  caption         text not null default '' check (char_length(caption) <= 120),
  role            public.portfolio_image_role not null default 'gallery',
  sort_order      integer not null default 0,
  created_by      uuid not null default auth.uid() references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  version         integer not null default 1,
  archived_at     timestamptz
);
create index portfolio_images_work_idx on public.portfolio_images (work_id, sort_order);
-- 비포·애프터는 사례마다 1장씩만 (보관된 것 제외)
create unique index portfolio_images_pair_uq on public.portfolio_images (work_id, role)
  where role in ('before', 'after') and archived_at is null;

alter table public.portfolio_works
  add constraint portfolio_works_cover_fk foreign key (cover_image_id) references public.portfolio_images(id);

-- ---------------------------------------------------------------------
-- 4. 트리거 — 범위 강제·검사·낙관적 잠금·변경 금지·감사
-- ---------------------------------------------------------------------

-- 사례: 원본 프로젝트가 같은 업체인지 / 대표 사진이 이 사례의 사진인지
create function private.portfolio_work_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.project_id is not null and not exists (
    select 1 from public.projects p where p.id = new.project_id and p.company_id = new.company_id
  ) then
    raise exception 'project_not_found' using errcode = 'P0001';
  end if;
  if new.cover_image_id is not null and not exists (
    select 1 from public.portfolio_images i
     where i.id = new.cover_image_id and i.work_id = new.id and i.archived_at is null
  ) then
    raise exception 'file_kind_mismatch' using errcode = 'P0001';
  end if;
  -- 동의를 기록하는 사람은 지금 로그인한 직원으로 강제
  -- 대표 사례는 업체가 정한 수(featured_limit, 설정 전이면 3)까지 (보관된 사례 제외).
  -- 새로 대표로 지정할 때만 검사한다 → 업체가 수를 줄여도 이미 지정된 사례 수정이 막히지 않음
  if new.is_featured and new.archived_at is null
     and (tg_op = 'INSERT' or not old.is_featured or old.archived_at is not null)
     and (select count(*) from public.portfolio_works w
           where w.company_id = new.company_id and w.is_featured and w.archived_at is null
             and w.id <> new.id)
         >= coalesce((select cp.featured_limit from public.company_portfolios cp
                       where cp.company_id = new.company_id), 3) then
    raise exception 'featured_limit' using errcode = 'P0001';
  end if;
  -- (클라이언트가 보낸 consent_by 는 무시)
  new.consent_by := case
    when new.consent_at is null then null
    when tg_op = 'UPDATE' and new.consent_at is not distinct from old.consent_at then old.consent_by
    else auth.uid() end;
  return new;
end $$;

-- 사진: 원본 파일이 같은 업체의 ready 이미지인지 (경로는 서버가 만든 값만)
create function private.portfolio_image_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.files f
     where f.id = new.source_file_id and f.company_id = new.company_id and f.status = 'ready'
       and f.kind in ('photo_original', 'design_preview', 'material_image')
  ) then
    raise exception 'file_kind_mismatch' using errcode = 'P0001';
  end if;
  if split_part(new.path, '/', 1) <> new.company_id::text
     or split_part(new.path, '/', 2) <> new.work_id::text then
    raise exception 'file_kind_mismatch' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- BEFORE 트리거는 이름순: a_scope(company_id 복사) → b_check(검사)
create trigger a_scope before insert on public.portfolio_images
  for each row execute function private.set_scope_from_parent('portfolio_works', 'work_id');
create trigger b_check before insert on public.portfolio_images
  for each row execute function private.portfolio_image_check();
create trigger check_row before insert or update on public.portfolio_works
  for each row execute function private.portfolio_work_check();

create trigger touch before update on public.company_portfolios for each row execute function private.touch_row();
create trigger touch before update on public.portfolio_works    for each row execute function private.touch_row();
create trigger touch before update on public.portfolio_images   for each row execute function private.touch_row();

create trigger immutable before update on public.company_portfolios
  for each row execute function private.guard_immutable('company_id');
create trigger immutable before update on public.portfolio_works
  for each row execute function private.guard_immutable('company_id', 'project_id', 'created_by');
create trigger immutable before update on public.portfolio_images
  for each row execute function private.guard_immutable('company_id', 'work_id', 'source_file_id', 'path', 'thumb_path', 'created_by');

create trigger audit after insert or update on public.company_portfolios for each row execute function private.audit_row();
create trigger audit after insert or update on public.portfolio_works    for each row execute function private.audit_row();
create trigger audit after insert or update on public.portfolio_images   for each row execute function private.audit_row();

-- ---------------------------------------------------------------------
-- 5. RLS — 표는 직원만. 쓰기는 대표·관리자만. DELETE 정책 없음
-- ---------------------------------------------------------------------
alter table public.company_portfolios enable row level security;
alter table public.portfolio_works    enable row level security;
alter table public.portfolio_images   enable row level security;

create policy company_portfolios_select on public.company_portfolios for select to authenticated
  using (private.is_company_staff(company_id));
create policy company_portfolios_insert on public.company_portfolios for insert to authenticated
  with check (private.is_company_manager(company_id));
create policy company_portfolios_update on public.company_portfolios for update to authenticated
  using (private.is_company_manager(company_id)) with check (private.is_company_manager(company_id));

create policy portfolio_works_select on public.portfolio_works for select to authenticated
  using (private.is_company_staff(company_id));
create policy portfolio_works_insert on public.portfolio_works for insert to authenticated
  with check (private.is_company_manager(company_id));
create policy portfolio_works_update on public.portfolio_works for update to authenticated
  using (private.is_company_manager(company_id)) with check (private.is_company_manager(company_id));

create policy portfolio_images_select on public.portfolio_images for select to authenticated
  using (private.is_company_staff(company_id));
create policy portfolio_images_insert on public.portfolio_images for insert to authenticated
  with check (private.is_company_manager(company_id));
create policy portfolio_images_update on public.portfolio_images for update to authenticated
  using (private.is_company_manager(company_id)) with check (private.is_company_manager(company_id));

revoke all on public.company_portfolios, public.portfolio_works, public.portfolio_images from anon;
grant select, insert, update on public.company_portfolios, public.portfolio_works, public.portfolio_images to authenticated;

-- ---------------------------------------------------------------------
-- 6. 공개 조회 RPC — 외부 방문자(anon)는 이 두 함수로만 읽는다.
--    돌려주는 열을 함수가 정한다: project_id·source_file_id·동의 기록·작성자는 절대 나가지 않는다.
-- ---------------------------------------------------------------------
create function public.get_public_portfolio(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'company', jsonb_build_object(
      'slug', c.slug::text, 'name', c.name, 'intro', cp.intro,
      'contactPhone', cp.contact_phone, 'contactUrl', cp.contact_url,
      'pageTone', cp.page_tone, 'logoPath', cp.logo_path,
      'businessName', cp.business_name, 'representative', cp.representative,
      'businessRegNo', cp.business_reg_no, 'address', cp.address, 'csHours', cp.cs_hours,
      'featuredLimit', cp.featured_limit),
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

create function public.get_public_portfolio_work(p_slug text, p_work uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', w.id, 'title', w.title, 'areaLabel', w.area_label, 'sizePyeong', w.size_pyeong,
    'spaces', to_jsonb(w.spaces), 'completedOn', w.completed_on, 'durationWeeks', w.duration_weeks,
    'summary', w.summary,
    -- 상세 화면의 상담 띠·푸터를 한 번에 그리기 위한 업체 정보 (목록 RPC 와 같은 공개 항목만)
    'company', jsonb_build_object(
      'slug', c.slug::text, 'name', c.name, 'contactPhone', cp.contact_phone, 'contactUrl', cp.contact_url,
      'pageTone', cp.page_tone, 'logoPath', cp.logo_path,
      'businessName', cp.business_name, 'representative', cp.representative,
      'businessRegNo', cp.business_reg_no, 'address', cp.address, 'csHours', cp.cs_hours,
      'featuredLimit', cp.featured_limit),
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

revoke execute on function public.get_public_portfolio(text), public.get_public_portfolio_work(text, uuid) from public;
grant execute on function public.get_public_portfolio(text), public.get_public_portfolio_work(text, uuid) to anon, authenticated;

revoke execute on function private.portfolio_work_check(), private.portfolio_image_check() from public, anon;
grant execute on function private.portfolio_work_check(), private.portfolio_image_check() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 7. 공개 버킷 — 누구나 읽기(공개 URL), 쓰기·지우기는 서버 service_role 만 (storage.objects 정책 없음)
--    WebP 만, 1장 최대 3MB (사본은 긴 변 2000px 이라 보통 300~600KB)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio-public', 'portfolio-public', true, 3145728, array['image/webp'])
on conflict (id) do nothing;

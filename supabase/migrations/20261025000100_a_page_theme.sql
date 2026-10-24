-- =====================================================================
-- 20261025000100_a_page_theme.sql
-- 소유: A · 관련: REQ-052, POL-026, CR-A-10 (progress/CR_고객홈_템플릿_설계안.md)
-- 내용: 고객 페이지 템플릿을 "홈 배경 1장" → "페이지(탭)별 이미지 + 페이지 분위기(배경색)" 로 확장
--   1) company_settings: default_page_images · default_page_tone (기본 템플릿)
--   2) projects: page_images · page_tone (고객 화면에 적용)
--   3) 기존 홈 배경(*_home_background_file_id)은 page_images.home 으로 옮기고 컬럼·트리거 제거
--   4) 신규 프로젝트: 비어 있으면 업체 템플릿 값 복사 (이미 만든 프로젝트는 그대로)
--   page_images = { "<portal tab>": "<files.id>" } — 키는 PORTAL_TABS, 값은 같은 업체의 ready company_logo 파일
-- 20261024000100_a_home_template.sql 은 dev DB 에 적용됐으므로 고치지 않고 이 파일에서 바꾼다
-- =====================================================================

-- 분위기 = 디자인 토큰처럼 정해 둔 프리셋 키만 (임의 색 금지)
create function private.valid_page_tone(v text) returns boolean
language sql immutable set search_path = '' as $$
  select v in ('default', 'ivory', 'sand', 'greige', 'sage', 'mist', 'clay')
$$;

-- 키는 고객 포털 탭, 값은 uuid 문자열
create function private.valid_page_images(v jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(v) = 'object'
     and coalesce((select bool_and(
                     e.key in ('home', 'designs', 'materials', 'requests', 'photos', 'schedule', 'estimates')
                     and jsonb_typeof(e.value) = 'string'
                     and (e.value #>> '{}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
                   from jsonb_each(v) e), true)
$$;

-- 모든 값이 같은 업체의 ready company_logo 파일인가 (company_logo_check 와 같은 기준)
-- 형식이 틀린 값은 여기서 통과시키고 CHECK(valid_page_images)가 거절한다 — BEFORE 트리거가 CHECK 보다 먼저 돌기 때문
create function private.page_images_ok(p_images jsonb, p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not private.valid_page_images(p_images) or not exists (
    select 1 from jsonb_each_text(p_images) e
     where not exists (select 1 from public.files f
                        where f.id = e.value::uuid and f.kind = 'company_logo'
                          and f.company_id = p_company and f.status = 'ready'))
$$;

alter table public.company_settings
  add column default_page_images jsonb not null default '{}'::jsonb,
  add column default_page_tone text not null default 'default',
  add constraint company_settings_page_images_valid check (private.valid_page_images(default_page_images)),
  add constraint company_settings_page_tone_valid check (private.valid_page_tone(default_page_tone));

alter table public.projects
  add column page_images jsonb not null default '{}'::jsonb,
  add column page_tone text not null default 'default',
  add constraint projects_page_images_valid check (private.valid_page_images(page_images)),
  add constraint projects_page_tone_valid check (private.valid_page_tone(page_tone));

-- 기존 홈 배경 → page_images.home (트리거 발생 전 단계라 검사 없이 옮김: 이미 검사를 통과한 값)
update public.company_settings
   set default_page_images = jsonb_build_object('home', default_home_background_file_id)
 where default_home_background_file_id is not null;
update public.projects
   set page_images = jsonb_build_object('home', home_background_file_id)
 where home_background_file_id is not null;

drop trigger background on public.company_settings;
drop trigger b_background on public.projects;
drop function private.company_settings_background_check();
drop function private.project_background_check();
alter table public.company_settings drop column default_home_background_file_id;
alter table public.projects drop column home_background_file_id;
drop function private.home_background_ok(uuid, uuid);

create function private.company_settings_page_images_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.default_page_images is distinct from old.default_page_images
     and not private.page_images_ok(new.default_page_images, new.company_id) then
    raise exception 'file_kind_mismatch' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger page_images before update of default_page_images on public.company_settings
  for each row execute function private.company_settings_page_images_check();

create function private.project_page_images_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' or new.page_images is distinct from old.page_images)
     and not private.page_images_ok(new.page_images, new.company_id) then
    raise exception 'file_kind_mismatch' using errcode = 'P0001';
  end if;
  return new;
end $$;
-- 이름 'b_page_images' : BEFORE 트리거는 이름순 → a_defaults(템플릿 복사) 뒤에 검사
create trigger b_page_images before insert or update of page_images on public.projects
  for each row execute function private.project_page_images_check();

-- 신규 프로젝트: 업체 템플릿 적용 (안내문 + 4영역 + 테마 + 페이지 이미지 + 분위기)
create or replace function private.project_defaults() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s public.company_settings;
begin
  select * into s from public.company_settings where company_id = new.company_id;
  if coalesce(new.home_message, '') = '' then
    new.home_message := coalesce(s.default_home_message, '');
  end if;
  if s.company_id is not null then
    -- 컬럼 기본값 그대로일 때만 템플릿으로 (호출자가 직접 지정한 값은 존중)
    if new.home_sections = '[{"key":"overview","visible":true},{"key":"recent","visible":true},{"key":"schedule","visible":true},{"key":"documents","visible":true}]'::jsonb then
      new.home_sections := s.default_home_sections;
    end if;
    if new.home_theme = 'brand' then
      new.home_theme := s.default_home_theme;
    end if;
    if new.page_images = '{}'::jsonb then
      new.page_images := s.default_page_images;
    end if;
    if new.page_tone = 'default' then
      new.page_tone := s.default_page_tone;
    end if;
  end if;
  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end $$;

-- 새 private 함수 실행 권한 (베이스라인 grants_hardening 과 같은 기준)
revoke execute on function private.valid_page_tone(text), private.valid_page_images(jsonb),
  private.page_images_ok(jsonb, uuid), private.company_settings_page_images_check(),
  private.project_page_images_check() from public, anon;
grant execute on function private.valid_page_tone(text), private.valid_page_images(jsonb),
  private.page_images_ok(jsonb, uuid), private.company_settings_page_images_check(),
  private.project_page_images_check() to authenticated, service_role;

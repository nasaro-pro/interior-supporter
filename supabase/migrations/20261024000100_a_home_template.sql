-- =====================================================================
-- 20261024000100_a_home_template.sql
-- 소유: A · 관련: REQ-052, POL-026, CR-A-10 (progress/CR_고객홈_템플릿_설계안.md)
-- 내용: 업체 기본 템플릿을 안내문 → 고객 홈 전체(안내문·커버 이미지·테마·4영역 순서·표시)로 확장
--   1) company_settings: default_home_sections · default_home_theme · default_home_cover_file_id
--   2) projects: home_theme · home_cover_file_id (고객 홈에 표시)
--   3) 신규 프로젝트: 비어 있거나 컬럼 기본값이면 업체 템플릿 값 복사 (이미 만든 프로젝트는 그대로)
--   4) 커버 파일 검사: 같은 업체의 ready 상태 company_logo 파일만 (계약 FileKind 변경 없이 재사용 —
--      company_logo 는 can_view_file 에서 업체 구성원·참여 고객이 열람 가능, 1MB 제한)
-- 롤백: 새 컬럼은 모두 기본값/nullable 이라 앱을 되돌려도 기존 동작 유지
-- =====================================================================

-- 테마 = 디자인 토큰 tone-* 키 (임의 색 금지)
create function private.valid_home_theme(v text) returns boolean
language sql immutable set search_path = '' as $$
  select v in ('brand', 'info', 'positive', 'caution', 'attention', 'neutral')
$$;

alter table public.company_settings
  add column default_home_sections jsonb not null
    default '[{"key":"overview","visible":true},{"key":"recent","visible":true},{"key":"schedule","visible":true},{"key":"documents","visible":true}]'::jsonb,
  add column default_home_theme text not null default 'brand',
  add column default_home_cover_file_id uuid references public.files(id),
  add constraint company_settings_home_sections_valid
    check (private.valid_home_sections(default_home_sections)),
  add constraint company_settings_home_theme_valid
    check (private.valid_home_theme(default_home_theme));

alter table public.projects
  add column home_theme text not null default 'brand',
  add column home_cover_file_id uuid references public.files(id),
  add constraint projects_home_theme_valid check (private.valid_home_theme(home_theme));

-- 커버 파일 검사 (company_logo_check 와 같은 기준)
create function private.home_cover_ok(p_file uuid, p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.files f
                  where f.id = p_file and f.kind = 'company_logo'
                    and f.company_id = p_company and f.status = 'ready')
$$;

create function private.company_settings_cover_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.default_home_cover_file_id is not null
     and new.default_home_cover_file_id is distinct from old.default_home_cover_file_id
     and not private.home_cover_ok(new.default_home_cover_file_id, new.company_id) then
    raise exception 'file_kind_mismatch' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger cover before update of default_home_cover_file_id on public.company_settings
  for each row execute function private.company_settings_cover_check();

create function private.project_cover_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.home_cover_file_id is not null
     and (tg_op = 'INSERT' or new.home_cover_file_id is distinct from old.home_cover_file_id)
     and not private.home_cover_ok(new.home_cover_file_id, new.company_id) then
    raise exception 'file_kind_mismatch' using errcode = 'P0001';
  end if;
  return new;
end $$;
-- 이름 'b_cover' : BEFORE 트리거는 이름순 → a_defaults(템플릿 복사) 뒤에 검사
create trigger b_cover before insert or update of home_cover_file_id on public.projects
  for each row execute function private.project_cover_check();

-- 신규 프로젝트: 업체 템플릿 적용 (안내문 + 4영역 + 테마 + 커버). 기존 동작(안내문·created_by)은 그대로
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
    if new.home_cover_file_id is null then
      new.home_cover_file_id := s.default_home_cover_file_id;
    end if;
  end if;
  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end $$;

-- 새 private 함수 실행 권한 (베이스라인 grants_hardening 과 같은 기준)
revoke execute on function private.valid_home_theme(text), private.home_cover_ok(uuid, uuid),
  private.company_settings_cover_check(), private.project_cover_check() from public, anon;
grant execute on function private.valid_home_theme(text), private.home_cover_ok(uuid, uuid),
  private.company_settings_cover_check(), private.project_cover_check() to authenticated, service_role;

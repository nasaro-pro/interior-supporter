-- =====================================================================
-- 20261006000100_a_foundation.sql
-- 소유: A (박예원) · 베이스라인(동결) · 관련: docs/03_아키텍처_데이터_보안.md
-- 내용: 확장·스키마·열거형·공통 헬퍼·A 영역 테이블·RLS·공통 트리거·회사 개설/초대 수락 RPC
-- 규칙: 이 파일은 스타터 고정 파일(수정 금지). 변경은 CR 승인 후 새 마이그레이션으로만 (docs/00_헌법_공통규칙.md 8장)
-- =====================================================================

create extension if not exists citext with schema extensions;

create schema if not exists private;
comment on schema private is '정책 헬퍼·트리거 함수 전용. API(PostgREST)에 노출하지 않는다.';

-- ---------------------------------------------------------------------
-- 1. 열거형 (값 추가는 새 마이그레이션에서 ALTER TYPE ... ADD VALUE 로만)
-- ---------------------------------------------------------------------
create type public.member_role       as enum ('owner', 'manager', 'pm');
create type public.participant_role  as enum ('pm', 'customer', 'field');
create type public.project_status    as enum ('planned', 'active', 'on_hold', 'completed');
create type public.file_status       as enum ('pending', 'ready', 'rejected');
create type public.file_kind         as enum (
  'design_original', 'design_preview', 'material_image', 'estimate_pdf',
  'photo_original', 'photo_thumb', 'company_logo'
);
create type public.confirm_state     as enum ('none', 'confirmed', 'needs_reconfirm');
create type public.request_status    as enum ('open', 'in_progress', 'resolved');
create type public.material_space    as enum (
  'living', 'kitchen', 'bathroom', 'bedroom', 'entrance', 'balcony', 'utility', 'common', 'other'
);
create type public.photo_phase       as enum (
  'demolition', 'plumbing', 'electrical', 'carpentry', 'tile', 'paint', 'film',
  'wallpaper', 'flooring', 'furniture', 'lighting', 'finishing', 'other'
);

-- ---------------------------------------------------------------------
-- 2. 범용 트리거 함수
-- ---------------------------------------------------------------------

-- POL-023: 업무 날짜 기준은 Asia/Seoul
create function private.today_kst() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Seoul')::date
$$;

-- 시스템 문맥: service_role 요청 또는 SECURITY DEFINER RPC 가 app.system_write=on 으로 표시한 경우
create function private.is_system_context() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.role(), '') = 'service_role'
      or coalesce(current_setting('app.system_write', true), '') = 'on'
$$;

-- 낙관적 잠금: UPDATE 마다 version+1, updated_at 갱신 (클라이언트는 .eq('version', v) 로 갱신)
create function private.touch_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;

-- 지정 컬럼 변경 금지 (TG_ARGV = 컬럼 이름 목록)
create function private.guard_immutable() returns trigger
language plpgsql set search_path = '' as $$
declare c text;
begin
  foreach c in array tg_argv loop
    if (to_jsonb(new) -> c) is distinct from (to_jsonb(old) -> c) then
      raise exception 'immutable_column:%', c using errcode = 'P0001';
    end if;
  end loop;
  return new;
end $$;

-- 시스템 전용 컬럼: 시스템 문맥이 아니면 변경 금지 (TG_ARGV = 컬럼 이름 목록)
create function private.guard_system_columns() returns trigger
language plpgsql set search_path = '' as $$
declare c text;
begin
  if private.is_system_context() then return new; end if;
  foreach c in array tg_argv loop
    if tg_op = 'INSERT' then
      continue; -- INSERT 기본값 강제는 각 테이블 트리거가 담당
    end if;
    if (to_jsonb(new) -> c) is distinct from (to_jsonb(old) -> c) then
      raise exception 'system_column:%', c using errcode = 'P0001';
    end if;
  end loop;
  return new;
end $$;

-- 프로젝트 소속 행: company_id 를 프로젝트에서 강제 복사 (클라이언트가 보낸 company_id 무시)
create function private.set_scope_from_project() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_company uuid;
begin
  select p.company_id into v_company from public.projects p where p.id = new.project_id;
  if v_company is null then
    raise exception 'project_not_found' using errcode = 'P0001';
  end if;
  new.company_id := v_company;
  return new;
end $$;

-- 하위 행: 부모 테이블(TG_ARGV[0])의 company_id/project_id 복사. 부모 FK 컬럼명 = TG_ARGV[1]
create function private.set_scope_from_parent() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_project uuid; v_parent uuid;
begin
  v_parent := (to_jsonb(new) ->> tg_argv[1])::uuid;
  execute format('select company_id, project_id from public.%I where id = $1', tg_argv[0])
    into v_company, v_project using v_parent;
  if v_company is null then
    raise exception 'parent_not_found:%', tg_argv[0] using errcode = 'P0001';
  end if;
  new := jsonb_populate_record(new, jsonb_build_object('company_id', v_company, 'project_id', v_project));
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3. 테이블 — 계정·업체·프로젝트·참여자·초대·고객·파일·감사·알림
-- ---------------------------------------------------------------------

-- ENT-profile
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 80),
  locale        text not null default 'ko' check (locale in ('ko', 'en')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  version       integer not null default 1
);

-- ENT-file (회사 로고가 참조하므로 companies 보다 먼저 선언, company FK 는 뒤에서 추가)
create table public.files (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null,
  project_id     uuid,
  kind           public.file_kind not null,
  bucket         text not null default 'project-files',
  path           text not null unique,
  original_name  text not null check (char_length(original_name) between 1 and 255),
  mime           text not null,
  size_bytes     bigint not null check (size_bytes > 0),
  sha256         text,
  status         public.file_status not null default 'pending',
  reject_reason  text,
  width          integer,
  height         integer,
  derived_from   uuid references public.files(id),
  owner_type     text,
  owner_id       uuid,
  uploaded_by    uuid not null references auth.users(id),
  created_at     timestamptz not null default now(),
  finalized_at   timestamptz
);
create index files_owner_idx on public.files (owner_type, owner_id);
create index files_project_idx on public.files (project_id);

-- ENT-company
create table public.companies (
  id            uuid primary key default gen_random_uuid(),
  slug          extensions.citext not null unique
                check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  name          text not null check (char_length(name) between 1 and 100),
  logo_file_id  uuid references public.files(id),
  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  version       integer not null default 1
);
alter table public.files
  add constraint files_company_fk foreign key (company_id) references public.companies(id);

-- ENT-company_setting (업체 내부 설정: 스태프 전용. 고객에게 노출되는 companies 와 분리)
create table public.company_settings (
  company_id            uuid primary key references public.companies(id),
  default_home_message  text not null default '' check (char_length(default_home_message) <= 2000),
  updated_at            timestamptz not null default now(),
  version               integer not null default 1
);

-- ENT-company_member (POL-002)
create table public.company_members (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id),
  user_id     uuid not null references auth.users(id),
  role        public.member_role not null,
  removed_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  version     integer not null default 1,
  unique (company_id, user_id)
);
create index company_members_user_idx on public.company_members (user_id);

-- ENT-project
create table public.projects (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id),
  name           text not null check (char_length(name) between 1 and 120),
  site_address   text not null default '' check (char_length(site_address) <= 200),
  start_date     date,
  end_date       date,
  status         public.project_status not null default 'planned',
  current_phase  text not null default '' check (char_length(current_phase) <= 60),
  is_public      boolean not null default false,               -- POL-016
  home_message   text not null default '' check (char_length(home_message) <= 2000),
  home_sections  jsonb not null default '[{"key":"overview","visible":true},{"key":"recent","visible":true},{"key":"schedule","visible":true},{"key":"documents","visible":true}]'::jsonb,
  created_by     uuid not null references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  archived_at    timestamptz,
  version        integer not null default 1,
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index projects_company_idx on public.projects (company_id);

-- POL-026: home_sections 는 4개 키의 순열 + visible 불리언
create function private.valid_home_sections(v jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(v) = 'array'
     and jsonb_array_length(v) = 4
     and (select count(distinct e ->> 'key') = 4
                 and bool_and(e ->> 'key' in ('overview', 'recent', 'schedule', 'documents'))
                 and bool_and(jsonb_typeof(e -> 'visible') = 'boolean')
          from jsonb_array_elements(v) e)
$$;
alter table public.projects add constraint projects_home_sections_valid
  check (private.valid_home_sections(home_sections));

-- ENT-project_participant (POL-003~007, POL-011)
create table public.project_participants (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id),
  project_id   uuid not null references public.projects(id),
  user_id      uuid not null references auth.users(id),
  role         public.participant_role not null,
  can_confirm  boolean not null default false,
  valid_from   date,
  valid_until  date,
  revoked_at   timestamptz,
  invited_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  version      integer not null default 1,
  unique (project_id, user_id, role),
  check (can_confirm = false or role = 'customer'),
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);
create index project_participants_user_idx on public.project_participants (user_id);

-- ENT-invitation (POL-007, POL-008)
create table public.invitations (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id),
  project_id        uuid references public.projects(id),
  email             extensions.citext not null check (char_length(email) <= 254),
  member_role       public.member_role,
  participant_role  public.participant_role,
  can_confirm       boolean not null default false,
  valid_from        date,
  valid_until       date,
  token_hash        text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at        timestamptz not null default (now() + interval '72 hours'),
  created_by        uuid not null references auth.users(id),
  created_at        timestamptz not null default now(),
  accepted_at       timestamptz,
  accepted_by       uuid references auth.users(id),
  revoked_at        timestamptz,
  check (
    (project_id is null and member_role in ('pm', 'manager') and participant_role is null)
    or
    (project_id is not null and participant_role in ('customer', 'field') and member_role is null)
  ),
  check (can_confirm = false or participant_role = 'customer'),
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

-- ENT-client (고객 카드: 로그인 계정과 별개. POL-032)
create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id),
  name        text not null check (char_length(name) between 1 and 80),
  phone       text not null default '' check (char_length(phone) <= 30),
  email       extensions.citext check (email is null or char_length(email) <= 254),
  memo        text not null default '' check (char_length(memo) <= 2000),
  user_id     uuid references auth.users(id),
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz,
  version     integer not null default 1
);
create index clients_company_idx on public.clients (company_id);

create table public.client_projects (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id),
  client_id   uuid not null references public.clients(id),
  project_id  uuid not null references public.projects(id),
  created_at  timestamptz not null default now(),
  unique (client_id, project_id),
  unique (project_id)          -- D03: 프로젝트 1개는 고객 카드 1개에만 귀속 (고객 카드 1:N 프로젝트)
);

-- ENT-audit_event (POL-028: 추가 전용. 사용자 INSERT/UPDATE/DELETE 불가)
create table public.audit_events (
  id           bigint generated always as identity primary key,
  company_id   uuid references public.companies(id),
  project_id   uuid references public.projects(id),
  actor_id     uuid references auth.users(id),
  event_type   text not null,
  object_type  text not null,
  object_id    uuid not null,
  before       jsonb,
  after        jsonb,
  occurred_at  timestamptz not null default now()
);
create index audit_events_company_idx on public.audit_events (company_id, occurred_at desc);
create index audit_events_project_idx on public.audit_events (project_id, occurred_at desc);

-- ENT-notification (POL-027: 앱 내 알림만. 제목·본문을 저장하지 않고 대상 참조만 저장)
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references auth.users(id),
  company_id    uuid not null references public.companies(id),
  project_id    uuid references public.projects(id),
  type          text not null check (type in (
                  'assignment_changed',
                  'item_published', 'item_confirmed', 'reconfirm_requested',
                  'request_created', 'request_corrected', 'request_replied', 'request_status_changed',
                  'photo_uploaded', 'photo_published', 'schedule_changed')),
  object_type   text not null,
  object_id     uuid not null,
  created_at    timestamptz not null default now(),
  read_at       timestamptz
);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

-- ---------------------------------------------------------------------
-- 4. 정책 헬퍼 (SECURITY DEFINER: RLS 재귀 방지. 모두 search_path='' 와 완전한 이름 사용)
--    *_for(p_user, ...) = 사용자 지정 버전, 이름 없는 버전 = auth.uid() 기준
-- ---------------------------------------------------------------------

create function private.member_role_for(p_user uuid, p_company uuid) returns public.member_role
language sql stable security definer set search_path = '' as $$
  select m.role from public.company_members m
  where m.company_id = p_company and m.user_id = p_user and m.removed_at is null
$$;

create function private.is_company_staff(p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.member_role_for((select auth.uid()), p_company) is not null
$$;

create function private.is_company_manager_for(p_user uuid, p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.member_role_for(p_user, p_company) in ('owner', 'manager'), false)
$$;

create function private.is_company_manager(p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_company_manager_for((select auth.uid()), p_company)
$$;

create function private.is_company_owner(p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.member_role_for((select auth.uid()), p_company) = 'owner', false)
$$;

-- POL-006: 배정 유효 = 미회수 + 오늘(KST)이 기간 안
create function private.has_participation_for(p_user uuid, p_project uuid, p_role public.participant_role)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_participants pp
    where pp.project_id = p_project and pp.user_id = p_user and pp.role = p_role
      and pp.revoked_at is null
      and (pp.valid_from  is null or pp.valid_from  <= private.today_kst())
      and (pp.valid_until is null or pp.valid_until >= private.today_kst())
  )
$$;

-- POL-003: 편집 권한 = 업체 owner/manager, 또는 업체 구성원이면서 유효한 pm 참여자
create function private.can_edit_project_for(p_user uuid, p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project
      and ( private.is_company_manager_for(p_user, p.company_id)
         or ( private.member_role_for(p_user, p.company_id) is not null
              and private.has_participation_for(p_user, p.id, 'pm') ) )
  )
$$;

create function private.can_edit_project(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_edit_project_for((select auth.uid()), p_project)
$$;

-- POL-004: 고객 열람 = 유효 customer 참여 + 프로젝트 공개 + 미보관
create function private.can_view_as_customer(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project and p.is_public and p.archived_at is null
      and private.has_participation_for((select auth.uid()), p.id, 'customer')
  )
$$;

-- POL-005: 시공팀 = 유효 field 참여 + 미보관
create function private.is_field_on(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project and p.archived_at is null
      and private.has_participation_for((select auth.uid()), p.id, 'field')
  )
$$;

-- POL-011: 확정권 = 고객 열람 가능 + can_confirm 참여
create function private.can_confirm_on(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_view_as_customer(p_project) and exists (
    select 1 from public.project_participants pp
    where pp.project_id = p_project and pp.user_id = (select auth.uid())
      and pp.role = 'customer' and pp.can_confirm and pp.revoked_at is null
      and (pp.valid_from  is null or pp.valid_from  <= private.today_kst())
      and (pp.valid_until is null or pp.valid_until >= private.today_kst())
  )
$$;

-- 프로필 열람: 본인, 같은 업체 구성원, 같은 프로젝트 참여자, 내가 편집하는 프로젝트의 참여자
create function private.can_see_profile(p_target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_target = (select auth.uid())
  or exists (
    select 1 from public.company_members a
    join public.company_members b on a.company_id = b.company_id
    where a.user_id = (select auth.uid()) and a.removed_at is null and b.user_id = p_target)
  or exists (
    select 1 from public.project_participants a
    join public.project_participants b on a.project_id = b.project_id
    where a.user_id = (select auth.uid()) and a.revoked_at is null and b.user_id = p_target)
  or exists (
    select 1 from public.project_participants b
    where b.user_id = p_target and private.can_edit_project(b.project_id))
$$;

-- 고객/시공팀이 업체명을 볼 수 있는지 (CL-01 업체 구분)
create function private.can_see_company(p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_company_staff(p_company) or exists (
    select 1 from public.project_participants pp
    join public.projects p on p.id = pp.project_id
    where p.company_id = p_company and pp.user_id = (select auth.uid()) and pp.revoked_at is null)
$$;

-- ---------------------------------------------------------------------
-- 5. 감사·알림 공통 함수
-- ---------------------------------------------------------------------

-- REQ-031: 모든 업무 테이블 AFTER INSERT/UPDATE. 변경된 키만 전후 값으로 기록
create function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  a jsonb := to_jsonb(new);
  b jsonb;
  diff_a jsonb := '{}'::jsonb;
  diff_b jsonb := '{}'::jsonb;
  k text;
  evt text;
  ignore text[] := array['version', 'updated_at', 'created_at'];
  secret text[] := array['token_hash'];
  v_company uuid;
  v_project uuid;
begin
  if tg_op = 'INSERT' then
    evt := 'created';
    diff_a := (a - ignore) - secret;
  else
    b := to_jsonb(old);
    for k in select jsonb_object_keys(a) loop
      continue when k = any(ignore) or k = any(secret);
      if (a -> k) is distinct from (b -> k) then
        diff_a := diff_a || jsonb_build_object(k, a -> k);
        diff_b := diff_b || jsonb_build_object(k, b -> k);
      end if;
    end loop;
    if diff_a = '{}'::jsonb then return null; end if;
    evt := case
      when (b ->> 'archived_at') is null and (a ->> 'archived_at') is not null then 'archived'
      when (b ->> 'archived_at') is not null and (a ->> 'archived_at') is null then 'restored'
      when (b -> 'is_public') = 'false'::jsonb and (a -> 'is_public') = 'true'::jsonb then 'published'
      when (b -> 'is_public') = 'true'::jsonb and (a -> 'is_public') = 'false'::jsonb then 'unpublished'
      when (b ->> 'revoked_at') is null and (a ->> 'revoked_at') is not null then 'revoked'
      else 'updated' end;
  end if;

  v_company := case when tg_table_name = 'companies' then (a ->> 'id')::uuid
                    else (a ->> 'company_id')::uuid end;
  v_project := case when tg_table_name = 'projects' then (a ->> 'id')::uuid
                    else (a ->> 'project_id')::uuid end;

  insert into public.audit_events (company_id, project_id, actor_id, event_type, object_type, object_id, before, after)
  values (v_company, v_project, auth.uid(), evt, tg_table_name, (a ->> 'id')::uuid,
          nullif(diff_b, '{}'::jsonb), diff_a);
  return null;
end $$;

-- REQ-041: 프로젝트 참여자에게 알림. 행위자 본인은 제외.
-- p_confirmers_only = 고객 중 확정권자만. 고객 대상은 프로젝트가 고객 공개 상태일 때만.
create function private.notify_participants(
  p_project uuid, p_role public.participant_role, p_type text,
  p_object_type text, p_object_id uuid,
  p_only_user uuid default null, p_confirmers_only boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_role = 'customer' and not exists (
    select 1 from public.projects p where p.id = p_project and p.is_public and p.archived_at is null
  ) then
    return;
  end if;
  insert into public.notifications (recipient_id, company_id, project_id, type, object_type, object_id)
  select distinct pp.user_id, pp.company_id, p_project, p_type, p_object_type, p_object_id
  from public.project_participants pp
  where pp.project_id = p_project and pp.role = p_role
    and private.has_participation_for(pp.user_id, p_project, p_role)
    and pp.user_id is distinct from auth.uid()
    and (p_only_user is null or pp.user_id = p_only_user)
    and (not p_confirmers_only or pp.can_confirm);
end $$;

-- 업로드 파일을 업무 행에 연결. 같은 프로젝트·준비 완료·미연결·업로더 본인·허용 종류만 (THR-008)
create function private.attach_file(
  p_file uuid, p_owner_type text, p_owner_id uuid, p_project uuid, p_kinds public.file_kind[]
) returns void
language plpgsql security definer set search_path = '' as $$
declare f public.files;
begin
  if p_file is null then return; end if;
  select * into f from public.files where id = p_file for update;
  if f.id is null then raise exception 'file_not_found' using errcode = 'P0001'; end if;
  if f.owner_id is not null and (f.owner_id <> p_owner_id or f.owner_type <> p_owner_type) then
    raise exception 'file_already_attached' using errcode = 'P0001';
  end if;
  if f.status <> 'ready' then raise exception 'file_not_ready' using errcode = 'P0001'; end if;
  if f.project_id is distinct from p_project then raise exception 'file_scope_mismatch' using errcode = 'P0001'; end if;
  if not (f.kind = any(p_kinds)) then raise exception 'file_kind_mismatch' using errcode = 'P0001'; end if;
  -- 사용자 요청이면(auth.uid() 존재) 시스템 문맥 여부와 무관하게 항상 업로더 본인 검사.
  -- (RPC 가 app.system_write 를 켠 상태에서도 우회되지 않도록 is_system_context 를 쓰지 않는다)
  if auth.uid() is not null and f.uploaded_by <> auth.uid() then
    raise exception 'file_not_owned' using errcode = 'P0001';
  end if;
  update public.files set owner_type = p_owner_type, owner_id = p_owner_id
   where id = p_file or derived_from = p_file;
end $$;

-- 파일 열람 가능 여부 (다운로드 라우트가 사용자 권한으로 files 행을 조회할 때 RLS 로 사용)
-- B·C 테이블은 이후 마이그레이션에서 생성되므로 동적 SQL 로 검사한다.
-- 소유 객체별 열람 판정.
-- 규약(필수): 파일을 소유하는 업무 테이블 T 는 자기 마이그레이션에서
--   private.row_visible_T(public.T) returns boolean  (SECURITY DEFINER, auth.uid() 기준)
-- 을 정의한다. 이 함수는 동적으로 호출하므로 foundation 을 수정하지 않고 B·C 가 확장할 수 있다.
create function private.can_view_owner(p_owner_type text, p_owner_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare ok boolean := false;
begin
  if p_owner_type is null
     or to_regclass('public.' || p_owner_type) is null
     or to_regprocedure('private.row_visible_' || p_owner_type || '(public.' || p_owner_type || ')') is null then
    return false;
  end if;
  execute format(
    'select exists (select 1 from public.%I t where t.id = $1 and private.%I(t))',
    p_owner_type, 'row_visible_' || p_owner_type)
  into ok using p_owner_id;
  return coalesce(ok, false);
end $$;

create function private.can_view_file(p_file public.files) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_file.kind = 'company_logo' then
    return private.can_see_company(p_file.company_id);
  end if;
  if p_file.project_id is null then return false; end if;
  if private.can_edit_project(p_file.project_id) then return true; end if;
  if p_file.owner_id is null then
    return p_file.uploaded_by = auth.uid();   -- 연결 전 업로드 확인용 (본인만)
  end if;
  return private.can_view_owner(p_file.owner_type, p_file.owner_id);
end $$;

-- ---------------------------------------------------------------------
-- 6. A 영역 트리거
-- ---------------------------------------------------------------------

-- auth.users 생성 시 프로필 자동 생성 (display_name 은 서버가 user_metadata 로 전달)
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, locale)
  values (new.id,
          left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)), 80),
          case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'ko' end)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- 신규 프로젝트: 업체 기본 안내문 적용
create function private.project_defaults() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.home_message, '') = '' then
    select s.default_home_message into new.home_message
      from public.company_settings s where s.company_id = new.company_id;
    new.home_message := coalesce(new.home_message, '');
  end if;
  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end $$;

-- 신규 프로젝트: 생성자를 pm 참여자로 자동 등록 (POL-003)
create function private.project_add_creator() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.project_participants (company_id, project_id, user_id, role, invited_by)
  values (new.company_id, new.id, new.created_by, 'pm', new.created_by)
  on conflict (project_id, user_id, role) do nothing;
  return null;
end $$;

-- owner 역할은 부여·변경·제거 불가 (소유자 이전은 범위 밖, POL-030)
create function private.guard_owner_role() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.is_system_context() then return new; end if;
  if (old.role = 'owner' or new.role = 'owner') and old.role is distinct from new.role then
    raise exception 'owner_role_locked' using errcode = 'P0001';
  end if;
  if old.role = 'owner' and new.removed_at is not null then
    raise exception 'owner_role_locked' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- 참여자 pm 직접 등록 대상은 업체 구성원이어야 함
create function private.participant_checks() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'pm' and private.member_role_for(new.user_id, new.company_id) is null then
    raise exception 'pm_must_be_member' using errcode = 'P0001';
  end if;
  return new;
end $$;

create function private.participant_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_participants(new.project_id, new.role, 'assignment_changed',
                                      'project_participants', new.id, new.user_id);
  return null;
end $$;

-- 초대 재발급: 같은 대상의 이전 미사용 초대를 자동 폐기 (POL-008)
create function private.invitation_supersede() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.invitations i
     set revoked_at = now()
   where i.id <> new.id and i.company_id = new.company_id
     and i.project_id is not distinct from new.project_id
     and i.email = new.email and i.accepted_at is null and i.revoked_at is null;
  return null;
end $$;

-- 고객 카드-프로젝트 연결: 같은 업체 프로젝트만
create function private.client_project_scope() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_client_company uuid; v_project_company uuid;
begin
  select company_id into v_client_company from public.clients where id = new.client_id;
  select company_id into v_project_company from public.projects where id = new.project_id;
  if v_client_company is null or v_client_company is distinct from v_project_company then
    raise exception 'scope_mismatch' using errcode = 'P0001';
  end if;
  new.company_id := v_client_company;
  return new;
end $$;

-- 회사 로고 연결 검사
create function private.company_logo_check() returns trigger
language plpgsql security definer set search_path = '' as $$
declare f public.files;
begin
  if new.logo_file_id is null or new.logo_file_id is not distinct from old.logo_file_id then
    return new;
  end if;
  select * into f from public.files where id = new.logo_file_id;
  if f.id is null or f.kind <> 'company_logo' or f.company_id <> new.id or f.status <> 'ready' then
    raise exception 'file_kind_mismatch' using errcode = 'P0001';
  end if;
  update public.files set owner_type = 'companies', owner_id = new.id where id = f.id;
  return new;
end $$;

-- 트리거 연결 ---------------------------------------------------------
create trigger touch before update on public.profiles          for each row execute function private.touch_row();
create trigger touch before update on public.companies         for each row execute function private.touch_row();
create trigger touch before update on public.company_settings  for each row execute function private.touch_row();
create trigger touch before update on public.company_members   for each row execute function private.touch_row();
create trigger touch before update on public.projects          for each row execute function private.touch_row();
create trigger touch before update on public.project_participants for each row execute function private.touch_row();
create trigger touch before update on public.clients           for each row execute function private.touch_row();

create trigger immutable before update on public.profiles  for each row execute function private.guard_immutable('id');
create trigger immutable before update on public.companies for each row execute function private.guard_immutable('id', 'slug', 'created_by');
create trigger immutable before update on public.company_members for each row execute function private.guard_immutable('company_id', 'user_id');
create trigger immutable before update on public.projects  for each row execute function private.guard_immutable('company_id', 'created_by');
create trigger immutable before update on public.project_participants for each row execute function private.guard_immutable('company_id', 'project_id', 'user_id', 'role');
create trigger immutable before update on public.invitations for each row execute function private.guard_immutable('company_id', 'project_id', 'email', 'member_role', 'participant_role', 'token_hash', 'created_by');
create trigger immutable before update on public.clients   for each row execute function private.guard_immutable('company_id', 'created_by');
create trigger immutable before update on public.notifications for each row execute function private.guard_immutable('recipient_id', 'company_id', 'project_id', 'type', 'object_type', 'object_id', 'created_at');
create trigger immutable before update on public.files for each row execute function private.guard_immutable('company_id', 'project_id', 'kind', 'bucket', 'path', 'uploaded_by');

create trigger a_defaults before insert on public.projects for each row execute function private.project_defaults();
create trigger add_creator after insert on public.projects for each row execute function private.project_add_creator();
create trigger scope before insert on public.project_participants for each row execute function private.set_scope_from_project();
create trigger checks before insert on public.project_participants for each row execute function private.participant_checks();
create trigger notify after insert or update of valid_from, valid_until, revoked_at, can_confirm on public.project_participants
  for each row execute function private.participant_notify();
create trigger owner_guard before update on public.company_members for each row execute function private.guard_owner_role();
create trigger supersede after insert on public.invitations for each row execute function private.invitation_supersede();
create trigger scope before insert on public.client_projects for each row execute function private.client_project_scope();
create trigger logo before update of logo_file_id on public.companies for each row execute function private.company_logo_check();

create trigger audit after insert or update on public.companies            for each row execute function private.audit_row();
create trigger audit after insert or update on public.company_settings     for each row execute function private.audit_row();
create trigger audit after insert or update on public.company_members      for each row execute function private.audit_row();
create trigger audit after insert or update on public.projects             for each row execute function private.audit_row();
create trigger audit after insert or update on public.project_participants for each row execute function private.audit_row();
create trigger audit after insert or update on public.invitations          for each row execute function private.audit_row();
create trigger audit after insert or update on public.clients              for each row execute function private.audit_row();
create trigger audit after insert or update on public.client_projects      for each row execute function private.audit_row();

-- company_settings 는 company_id 가 PK 이므로 audit object_id 용 id 가 없다 → 뷰 대신 company_id 를 id 로 노출
-- (audit_row 는 a->>'id' 를 사용하므로 company_settings 에 생성 컬럼 id 를 둔다)
alter table public.company_settings add column id uuid generated always as (company_id) stored;

-- ---------------------------------------------------------------------
-- 7. RLS (모든 public 테이블 활성화. DELETE 정책은 두지 않는다: POL-020)
-- ---------------------------------------------------------------------
alter table public.profiles             enable row level security;
alter table public.files                enable row level security;
alter table public.companies            enable row level security;
alter table public.company_settings     enable row level security;
alter table public.company_members      enable row level security;
alter table public.projects             enable row level security;
alter table public.project_participants enable row level security;
alter table public.invitations          enable row level security;
alter table public.clients              enable row level security;
alter table public.client_projects      enable row level security;
alter table public.audit_events         enable row level security;
alter table public.notifications        enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (private.can_see_profile(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- companies (생성은 RPC 전용)
create policy companies_select on public.companies for select to authenticated
  using (private.can_see_company(id));
create policy companies_update on public.companies for update to authenticated
  using (private.is_company_manager(id)) with check (private.is_company_manager(id));

create policy company_settings_select on public.company_settings for select to authenticated
  using (private.is_company_staff(company_id));
create policy company_settings_update on public.company_settings for update to authenticated
  using (private.is_company_manager(company_id)) with check (private.is_company_manager(company_id));

-- company_members (추가는 RPC 전용, 역할 변경·제거는 owner 만: POL-030)
create policy company_members_select on public.company_members for select to authenticated
  using (private.is_company_staff(company_id) or user_id = (select auth.uid()));
create policy company_members_update on public.company_members for update to authenticated
  using (private.is_company_owner(company_id)) with check (private.is_company_owner(company_id));

-- projects
create policy projects_select on public.projects for select to authenticated
  using (private.can_edit_project(id) or private.can_view_as_customer(id) or private.is_field_on(id));
create policy projects_insert on public.projects for insert to authenticated
  with check (private.is_company_staff(company_id) and created_by = (select auth.uid()));
create policy projects_update on public.projects for update to authenticated
  using (private.can_edit_project(id)) with check (private.can_edit_project(id));

-- project_participants (고객·시공팀 추가는 초대 수락 RPC 전용, pm 은 편집자가 직접 배정)
create policy participants_select on public.project_participants for select to authenticated
  using (private.can_edit_project(project_id) or user_id = (select auth.uid()));
create policy participants_insert on public.project_participants for insert to authenticated
  with check (private.can_edit_project(project_id) and role = 'pm');
create policy participants_update on public.project_participants for update to authenticated
  using (private.can_edit_project(project_id)) with check (private.can_edit_project(project_id));

-- invitations
create policy invitations_select on public.invitations for select to authenticated
  using (case when project_id is null then private.is_company_manager(company_id)
              else private.can_edit_project(project_id) end);
create policy invitations_insert on public.invitations for insert to authenticated
  with check (
    created_by = (select auth.uid()) and accepted_at is null and revoked_at is null
    and case
      when project_id is null then
        (member_role = 'pm' and private.is_company_manager(company_id))
        or (member_role = 'manager' and private.is_company_owner(company_id))
      else private.can_edit_project(project_id)
           and company_id = (select p.company_id from public.projects p where p.id = project_id)
    end);
create policy invitations_update on public.invitations for update to authenticated
  using (case when project_id is null then private.is_company_manager(company_id)
              else private.can_edit_project(project_id) end)
  with check (accepted_at is null);

-- clients / client_projects (업체 스태프)
create policy clients_select on public.clients for select to authenticated
  using (private.is_company_staff(company_id));
create policy clients_insert on public.clients for insert to authenticated
  with check (private.is_company_staff(company_id) and created_by = (select auth.uid()));
create policy clients_update on public.clients for update to authenticated
  using (private.is_company_staff(company_id)) with check (private.is_company_staff(company_id));

create policy client_projects_select on public.client_projects for select to authenticated
  using (private.is_company_staff(company_id));
create policy client_projects_insert on public.client_projects for insert to authenticated
  with check (private.can_edit_project(project_id));

-- files (INSERT = 업로드 의도 등록. 상태 갱신은 서버 service_role 전용)
create policy files_select on public.files for select to authenticated
  using (private.can_view_file(files));
create policy files_insert on public.files for insert to authenticated
  with check (
    uploaded_by = (select auth.uid()) and status = 'pending' and owner_id is null
    and case
      when kind = 'company_logo' then project_id is null and private.is_company_manager(company_id)
      when kind in ('photo_original') then
        (private.can_edit_project(project_id) or private.is_field_on(project_id))
        and company_id = (select p.company_id from public.projects p where p.id = project_id)
      when kind = 'photo_thumb' then false   -- 썸네일은 서버가 생성
      else private.can_edit_project(project_id)
        and company_id = (select p.company_id from public.projects p where p.id = project_id)
    end);

-- audit_events (조회만. 고객·시공팀 비노출: POL-028)
create policy audit_select on public.audit_events for select to authenticated
  using (
    case when project_id is null then private.is_company_manager(company_id)
         else private.can_edit_project(project_id) end);

-- notifications (본인 것만. read_at 만 변경 가능 — 나머지는 immutable 트리거)
create policy notifications_select on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 8. RPC (IF-rpc-*)
-- ---------------------------------------------------------------------

-- IF-rpc-create-company: 셀프 가입 (POL-009). service_role 전용 — 서버가 사용자 생성 직후 호출
create function public.create_company_with_owner(
  p_user uuid, p_company_name text, p_slug text, p_display_name text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_company uuid;
begin
  perform set_config('app.system_write', 'on', true);
  insert into public.companies (slug, name, created_by)
  values (lower(p_slug), p_company_name, p_user)
  returning id into v_company;
  insert into public.company_settings (company_id) values (v_company);
  insert into public.company_members (company_id, user_id, role) values (v_company, p_user, 'owner');
  update public.profiles set display_name = left(p_display_name, 80) where id = p_user;
  perform set_config('app.system_write', 'off', true);
  return v_company;
exception when unique_violation then
  raise exception 'slug_taken' using errcode = 'P0001';
end $$;

-- IF-rpc-accept-invitation: service_role 전용 — 서버가 (신규면 사용자 생성 후) 호출
create function public.accept_invitation(p_user uuid, p_token_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invitations;
  v_email text;
begin
  perform set_config('app.system_write', 'on', true);
  select * into inv from public.invitations where token_hash = p_token_hash for update;
  if inv.id is null then raise exception 'invite_not_found' using errcode = 'P0001'; end if;
  if inv.accepted_at is not null then raise exception 'invite_used' using errcode = 'P0001'; end if;
  if inv.revoked_at is not null or inv.expires_at <= now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;
  select u.email into v_email from auth.users u where u.id = p_user;
  if v_email is null or lower(v_email) <> lower(inv.email::text) then
    raise exception 'invite_email_mismatch' using errcode = 'P0001';
  end if;

  if inv.project_id is null then
    -- 초대한 사람이 아직 권한을 가지고 있어야 함
    if not private.is_company_manager_for(inv.created_by, inv.company_id) then
      raise exception 'invite_revoked' using errcode = 'P0001';
    end if;
    insert into public.company_members (company_id, user_id, role)
    values (inv.company_id, p_user, inv.member_role)
    on conflict (company_id, user_id) do update
      set role = case when public.company_members.role = 'owner' then 'owner'::public.member_role
                      else excluded.role end,
          removed_at = null;
  else
    if not private.can_edit_project_for(inv.created_by, inv.project_id) then
      raise exception 'invite_revoked' using errcode = 'P0001';
    end if;
    insert into public.project_participants
      (company_id, project_id, user_id, role, can_confirm, valid_from, valid_until, invited_by)
    values (inv.company_id, inv.project_id, p_user, inv.participant_role, inv.can_confirm,
            inv.valid_from, inv.valid_until, inv.created_by)
    on conflict (project_id, user_id, role) do update
      set revoked_at = null, can_confirm = excluded.can_confirm,
          valid_from = excluded.valid_from, valid_until = excluded.valid_until;
  end if;

  update public.invitations set accepted_at = now(), accepted_by = p_user where id = inv.id;
  perform set_config('app.system_write', 'off', true);
  return jsonb_build_object(
    'company_id', inv.company_id,
    'project_id', inv.project_id,
    'area', case when inv.project_id is null then 'app'
                 when inv.participant_role = 'customer' then 'portal' else 'field' end);
end $$;

-- IF-rpc-storage-usage: PM-64 저장공간 (manager 전용)
create function public.company_storage_usage(p_company uuid) returns bigint
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_company_manager(p_company) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return coalesce((select sum(size_bytes) from public.files
                    where company_id = p_company and status = 'ready'), 0);
end $$;

-- 비밀번호 재설정 대상 검사 (POL-010): 요청자가 manager 인 업체에 대상이 구성원/참여자로 속하는지
create function public.can_issue_password_reset(p_actor uuid, p_company uuid, p_target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_company_manager_for(p_actor, p_company)
     and p_actor <> p_target
     and private.member_role_for(p_target, p_company) is distinct from 'owner'
     and ( private.member_role_for(p_target, p_company) is not null
           or exists (select 1 from public.project_participants pp
                      where pp.company_id = p_company and pp.user_id = p_target) )
$$;

-- ---------------------------------------------------------------------
-- 9. Storage 버킷 (비공개. storage.objects 에 authenticated 정책을 두지 않음 → 서버 service_role 만 접근)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 52428800)
on conflict (id) do nothing;

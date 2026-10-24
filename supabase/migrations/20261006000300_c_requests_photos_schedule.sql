-- =====================================================================
-- 20261006000300_c_requests_photos_schedule.sql
-- 소유: C (이재서) · 베이스라인(동결) · 관련: REQ-200~234, POL-005, POL-017~019, POL-022
-- 내용: 고객 요청(원문·정정·답변)·현장 사진·일정, RLS, 알림 규칙
-- 의존: 20261006000100_a_foundation.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 테이블
-- ---------------------------------------------------------------------

-- ENT-request (POL-019: 제목·원문 불변)
create table public.requests (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id),
  project_id   uuid not null references public.projects(id),
  author_id    uuid not null references auth.users(id),
  title        text not null check (char_length(title) between 1 and 120),
  body         text not null check (char_length(body) between 1 and 4000),
  status       public.request_status not null default 'open',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  archived_at  timestamptz,
  version      integer not null default 1
);
create index requests_project_idx on public.requests (project_id, created_at desc);

-- ENT-request_correction (추가 전용)
create table public.request_corrections (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id),
  project_id  uuid not null references public.projects(id),
  request_id  uuid not null references public.requests(id),
  author_id   uuid not null references auth.users(id),
  body        text not null check (char_length(body) between 1 and 4000),
  created_at  timestamptz not null default now()
);
create index request_corrections_request_idx on public.request_corrections (request_id, created_at);

-- ENT-request_reply (추가 전용. 수정 대신 새 답변)
create table public.request_replies (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id),
  project_id  uuid not null references public.projects(id),
  request_id  uuid not null references public.requests(id),
  author_id   uuid not null references auth.users(id),
  body        text not null check (char_length(body) between 1 and 4000),
  created_at  timestamptz not null default now()
);
create index request_replies_request_idx on public.request_replies (request_id, created_at);

-- ENT-photo (POL-017: 기본 비공개, 공개 전환은 편집자만)
create table public.photos (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id),
  project_id     uuid not null references public.projects(id),
  file_id        uuid not null unique references public.files(id),
  thumb_file_id  uuid unique references public.files(id),
  phase          public.photo_phase not null default 'other',
  captured_on    date,
  description    text not null default '' check (char_length(description) <= 500),
  is_public      boolean not null default false,
  uploaded_by    uuid not null references auth.users(id),
  uploader_role  text not null check (uploader_role in ('staff', 'field')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  archived_at    timestamptz,
  version        integer not null default 1
);
create index photos_project_idx on public.photos (project_id, captured_on desc nulls last, created_at desc);

-- ENT-schedule_event (POL-023: date/time 은 Asia/Seoul 달력 값)
create table public.schedule_events (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id),
  project_id    uuid not null references public.projects(id),
  title         text not null check (char_length(title) between 1 and 120),
  description   text not null default '' check (char_length(description) <= 2000),
  start_date    date not null,
  start_time    time,
  end_date      date,
  end_time      time,
  is_public     boolean not null default false,
  related_type  text check (related_type is null or related_type in
                  ('designs', 'materials', 'estimate_versions', 'requests', 'photos')),
  related_id    uuid,
  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz,
  version       integer not null default 1,
  check (end_date is null or end_date >= start_date),
  check (end_time is null or start_time is not null),
  check (not (coalesce(end_date, start_date) = start_date and start_time is not null
              and end_time is not null and end_time < start_time)),
  check ((related_type is null) = (related_id is null))
);
create index schedule_events_project_idx on public.schedule_events (project_id, start_date);

-- ---------------------------------------------------------------------
-- 2. 열람 판정 함수 (규약: private.row_visible_<table>)
-- ---------------------------------------------------------------------

-- POL-018 (D03 기본 차단): 고객은 자기가 작성한 요청만 열람 (같은 프로젝트의 다른 고객 계정과 공유하지 않음)
create function private.row_visible_requests(r public.requests) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_edit_project(r.project_id)
      or (r.archived_at is null and r.author_id = (select auth.uid())
          and private.can_view_as_customer(r.project_id))
$$;

create function private.row_visible_photos(p public.photos) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_edit_project(p.project_id)
      or (p.archived_at is null and private.is_field_on(p.project_id))            -- POL-005
      or (p.is_public and p.archived_at is null and private.can_view_as_customer(p.project_id))
$$;

create function private.row_visible_schedule_events(e public.schedule_events) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_edit_project(e.project_id)
      or (e.is_public and e.archived_at is null and private.can_view_as_customer(e.project_id))
$$;

-- ---------------------------------------------------------------------
-- 3. 트리거 함수
-- ---------------------------------------------------------------------

create function private.request_insert_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.author_id := auth.uid();
  new.status := 'open';
  return new;
end $$;

create function private.child_author_default() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.author_id := auth.uid();
  return new;
end $$;

-- 사진: 업로더·역할 강제, 시공팀 업로드는 비공개 강제 (POL-017), 파일 연결
create function private.photo_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.uploaded_by := auth.uid();
  if private.can_edit_project(new.project_id) then
    new.uploader_role := 'staff';
  else
    new.uploader_role := 'field';
    new.is_public := false;
  end if;
  return new;
end $$;

-- 시공팀은 본인 사진의 공정·촬영일·설명만 수정 (공개·보관 변경 불가)
create function private.photo_before_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_edit_project(old.project_id) and not private.is_system_context() then
    if old.uploaded_by <> auth.uid() then
      raise exception 'forbidden' using errcode = 'P0001';
    end if;
    if new.is_public is distinct from old.is_public or new.archived_at is distinct from old.archived_at then
      raise exception 'forbidden' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create function private.photo_attach() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.attach_file(new.file_id, 'photos', new.id, new.project_id, array['photo_original']::public.file_kind[]);
  -- 썸네일(derived_from = file_id)은 attach_file 이 함께 연결한다. thumb_file_id 는 일치 여부만 검사
  if new.thumb_file_id is not null and not exists (
       select 1 from public.files f where f.id = new.thumb_file_id and f.derived_from = new.file_id and f.kind = 'photo_thumb') then
    raise exception 'file_kind_mismatch' using errcode = 'P0001';
  end if;
  return null;
end $$;

create function private.schedule_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.created_by := auth.uid();
  return new;
end $$;

-- 알림 ----------------------------------------------------------------
create function private.notify_request_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_participants(new.project_id, 'pm', 'request_created', 'requests', new.id);
  return null;
end $$;

create function private.notify_request_corrected() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_participants(new.project_id, 'pm', 'request_corrected', 'requests', new.request_id);
  return null;
end $$;

create function private.notify_request_replied() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- 요청 작성자에게만 (POL-018)
  perform private.notify_participants(new.project_id, 'customer', 'request_replied', 'requests', new.request_id,
    (select r.author_id from public.requests r where r.id = new.request_id));
  return null;
end $$;

create function private.notify_request_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    perform private.notify_participants(new.project_id, 'customer', 'request_status_changed', 'requests', new.id, new.author_id);
  end if;
  return null;
end $$;

create function private.notify_photo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.uploader_role = 'field' then
    perform private.notify_participants(new.project_id, 'pm', 'photo_uploaded', 'photos', new.id);
  end if;
  if new.is_public and new.archived_at is null and (tg_op = 'INSERT' or not old.is_public) then
    perform private.notify_participants(new.project_id, 'customer', 'photo_published', 'photos', new.id);
  end if;
  return null;
end $$;

create function private.notify_schedule() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.is_public and new.archived_at is null and (
       tg_op = 'INSERT' or not old.is_public
       or (new.start_date, new.start_time, new.end_date, new.end_time)
          is distinct from (old.start_date, old.start_time, old.end_date, old.end_time)) then
    perform private.notify_participants(new.project_id, 'customer', 'schedule_changed', 'schedule_events', new.id);
  end if;
  return null;
end $$;

-- 트리거 연결 ---------------------------------------------------------
create trigger scope before insert on public.requests            for each row execute function private.set_scope_from_project();
create trigger scope before insert on public.photos              for each row execute function private.set_scope_from_project();
create trigger scope before insert on public.schedule_events     for each row execute function private.set_scope_from_project();
create trigger scope before insert on public.request_corrections for each row execute function private.set_scope_from_parent('requests', 'request_id');
create trigger scope before insert on public.request_replies     for each row execute function private.set_scope_from_parent('requests', 'request_id');

create trigger a_defaults before insert on public.requests            for each row execute function private.request_insert_defaults();
create trigger a_defaults before insert on public.request_corrections for each row execute function private.child_author_default();
create trigger a_defaults before insert on public.request_replies     for each row execute function private.child_author_default();
create trigger a_defaults before insert on public.photos              for each row execute function private.photo_before_insert();
create trigger a_defaults before insert on public.schedule_events     for each row execute function private.schedule_defaults();

create trigger touch before update on public.requests        for each row execute function private.touch_row();
create trigger touch before update on public.photos          for each row execute function private.touch_row();
create trigger touch before update on public.schedule_events for each row execute function private.touch_row();

create trigger immutable before update on public.requests for each row execute function private.guard_immutable('company_id', 'project_id', 'author_id', 'title', 'body', 'created_at');
create trigger immutable before update on public.photos   for each row execute function private.guard_immutable('company_id', 'project_id', 'file_id', 'thumb_file_id', 'uploaded_by', 'uploader_role');
create trigger immutable before update on public.schedule_events for each row execute function private.guard_immutable('company_id', 'project_id', 'created_by');
create trigger b_field_guard before update on public.photos for each row execute function private.photo_before_update();

create trigger attach after insert on public.photos for each row execute function private.photo_attach();

create trigger notify after insert on public.requests            for each row execute function private.notify_request_created();
create trigger notify after insert on public.request_corrections for each row execute function private.notify_request_corrected();
create trigger notify after insert on public.request_replies     for each row execute function private.notify_request_replied();
create trigger notify_status after update of status on public.requests for each row execute function private.notify_request_status();
create trigger notify after insert or update of is_public on public.photos for each row execute function private.notify_photo();
create trigger notify after insert or update on public.schedule_events for each row execute function private.notify_schedule();

create trigger audit after insert or update on public.requests            for each row execute function private.audit_row();
create trigger audit after insert on public.request_corrections           for each row execute function private.audit_row();
create trigger audit after insert on public.request_replies               for each row execute function private.audit_row();
create trigger audit after insert or update on public.photos              for each row execute function private.audit_row();
create trigger audit after insert or update on public.schedule_events     for each row execute function private.audit_row();

-- ---------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------
alter table public.requests            enable row level security;
alter table public.request_corrections enable row level security;
alter table public.request_replies     enable row level security;
alter table public.photos              enable row level security;
alter table public.schedule_events     enable row level security;

-- requests: 고객만 작성, 편집자는 상태·보관만 변경 (제목·원문 불변 트리거)
create policy requests_select on public.requests for select to authenticated using (private.row_visible_requests(requests));
create policy requests_insert on public.requests for insert to authenticated
  with check (private.can_view_as_customer(project_id) and author_id = (select auth.uid()));
create policy requests_update on public.requests for update to authenticated
  using (private.can_edit_project(project_id)) with check (private.can_edit_project(project_id));

-- 정정: 원 요청 작성자 본인만 추가
create policy request_corrections_select on public.request_corrections for select to authenticated
  using (exists (select 1 from public.requests r where r.id = request_id and private.row_visible_requests(r)));
create policy request_corrections_insert on public.request_corrections for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (
    select 1 from public.requests r
    where r.id = request_id and r.author_id = (select auth.uid()) and r.archived_at is null
      and private.can_view_as_customer(r.project_id)));

-- 답변: 편집자만 추가
create policy request_replies_select on public.request_replies for select to authenticated
  using (exists (select 1 from public.requests r where r.id = request_id and private.row_visible_requests(r)));
create policy request_replies_insert on public.request_replies for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (
    select 1 from public.requests r where r.id = request_id and private.can_edit_project(r.project_id)));

-- photos
create policy photos_select on public.photos for select to authenticated using (private.row_visible_photos(photos));
create policy photos_insert on public.photos for insert to authenticated
  with check (uploaded_by = (select auth.uid())
              and (private.can_edit_project(project_id) or private.is_field_on(project_id)));
create policy photos_update on public.photos for update to authenticated
  using (private.can_edit_project(project_id) or (private.is_field_on(project_id) and uploaded_by = (select auth.uid())))
  with check (private.can_edit_project(project_id) or (private.is_field_on(project_id) and uploaded_by = (select auth.uid())));

-- schedule_events
create policy schedule_select on public.schedule_events for select to authenticated
  using (private.row_visible_schedule_events(schedule_events));
create policy schedule_insert on public.schedule_events for insert to authenticated
  with check (private.can_edit_project(project_id));
create policy schedule_update on public.schedule_events for update to authenticated
  using (private.can_edit_project(project_id)) with check (private.can_edit_project(project_id));

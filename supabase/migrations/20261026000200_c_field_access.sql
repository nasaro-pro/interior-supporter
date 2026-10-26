-- =====================================================================
-- 20261026000200_c_field_access.sql
-- 소유: 시공팀 파트 (feature/field) · 통합본 7장 F1·F2·F8·F9·F11 · CR-11
-- 내용
--   1) project_field_settings: 담당자가 프로젝트마다 시공팀에게 보여 줄 탭과 '시공팀 사진 바로 공개'를 켠다 (기본 모두 꺼짐)
--   2) 시공팀 전용 조회 RPC: 현장 목록·현장 1곳·일정·확정 도안·확정 자재 (보기만. 견적·고객 연락처·단가는 주지 않는다)
--      도안·자재 표의 RLS(B 소유)는 건드리지 않고 SECURITY DEFINER 함수로 필요한 열만 준다
--   3) 파일 열람: 켜진 탭의 확정 도안 미리보기·원본, 확정 자재 이미지를 시공팀도 받는다 (can_view_file 확장)
--   4) 사진: 바로 공개가 켜졌으면 시공팀 사진을 공개로 저장(F9), 본인 사진은 고객 공개 전까지 보관(숨김) 가능(F8)
--   5) 알림: 일정 탭이 켜진 현장의 일정이 바뀌면 시공팀에게도 알림(F11)
-- 배정 기간이 끝난 현장은 지금처럼 바로 차단한다(POL-006 유지 — is_field_on 그대로 사용).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 프로젝트별 시공팀 설정
-- ---------------------------------------------------------------------
create table public.project_field_settings (
  project_id         uuid primary key references public.projects(id),
  id                 uuid not null unique default gen_random_uuid(),   -- 변경이력(audit_row) 대상 id
  company_id         uuid not null references public.companies(id),
  show_schedule      boolean not null default false,
  show_designs       boolean not null default false,
  show_materials     boolean not null default false,
  photo_auto_public  boolean not null default false,
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users(id)
);

create function private.field_settings_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create trigger scope before insert on public.project_field_settings
  for each row execute function private.set_scope_from_project();
create trigger a_defaults before insert or update on public.project_field_settings
  for each row execute function private.field_settings_defaults();
create trigger immutable before update on public.project_field_settings
  for each row execute function private.guard_immutable('project_id', 'company_id', 'id');
create trigger audit after insert or update on public.project_field_settings
  for each row execute function private.audit_row();

alter table public.project_field_settings enable row level security;
create policy project_field_settings_select on public.project_field_settings for select to authenticated
  using (private.can_edit_project(project_id));
create policy project_field_settings_insert on public.project_field_settings for insert to authenticated
  with check (private.can_edit_project(project_id));
create policy project_field_settings_update on public.project_field_settings for update to authenticated
  using (private.can_edit_project(project_id)) with check (private.can_edit_project(project_id));

-- 시공팀이 이 현장에서 해당 탭을 볼 수 있는가 (유효 배정 + 담당자가 켠 탭)
create function private.field_sees(p_project uuid, p_what text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_field_on(p_project) and coalesce((
    select case p_what
             when 'schedule'  then s.show_schedule
             when 'designs'   then s.show_designs
             when 'materials' then s.show_materials
             else false end
    from public.project_field_settings s where s.project_id = p_project), false)
$$;

-- ---------------------------------------------------------------------
-- 2. 시공팀 조회 RPC (보기만)
-- ---------------------------------------------------------------------

-- F1 현장 목록: 유효 배정 현장 + 배정 기간 + 오늘 일정 제목(일정 탭이 켜진 현장만)
create function public.field_sites()
returns table (id uuid, company_id uuid, company_name text, name text, site_address text,
               valid_from date, valid_until date, today_events text[])
language sql stable security definer set search_path = '' as $$
  select p.id, p.company_id, c.name, p.name, p.site_address,
         pp.valid_from, pp.valid_until,
         case when private.field_sees(p.id, 'schedule') then coalesce((
           select array_agg(e.title order by e.start_time nulls first, e.title)
           from public.schedule_events e
           where e.project_id = p.id and e.archived_at is null
             and private.today_kst() between e.start_date and coalesce(e.end_date, e.start_date)), '{}')
         else '{}' end
  from public.projects p
  join public.companies c on c.id = p.company_id
  join lateral (select x.valid_from, x.valid_until from public.project_participants x
                where x.project_id = p.id and x.user_id = (select auth.uid()) and x.role = 'field'
                  and x.revoked_at is null
                order by x.valid_until desc nulls first limit 1) pp on true
  where private.is_field_on(p.id) and p.archived_at is null
  order by p.name
$$;

-- F2 현장 1곳: 머리글·탭 표시용 + 사진 바로 공개 여부(F9 안내 문구) (볼 수 없으면 0행)
create function public.field_site(p_project uuid)
returns table (id uuid, company_id uuid, name text, site_address text, page_tone text,
               show_schedule boolean, show_designs boolean, show_materials boolean,
               photo_auto_public boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.company_id, p.name, p.site_address, p.page_tone,
         private.field_sees(p.id, 'schedule'), private.field_sees(p.id, 'designs'),
         private.field_sees(p.id, 'materials'),
         coalesce((select s.photo_auto_public from public.project_field_settings s
                   where s.project_id = p.id), false)
  from public.projects p
  where p.id = p_project and p.archived_at is null and private.is_field_on(p.id)
$$;

-- F2 일정 (담당자가 켠 경우만)
create function public.field_schedule(p_project uuid)
returns table (id uuid, title text, description text, start_date date, start_time time,
               end_date date, end_time time)
language sql stable security definer set search_path = '' as $$
  select e.id, e.title, e.description, e.start_date, e.start_time, e.end_date, e.end_time
  from public.schedule_events e
  where e.project_id = p_project and e.archived_at is null and private.field_sees(p_project, 'schedule')
  order by e.start_date, e.start_time nulls first, e.title
$$;

-- F2 확정 도안: 확정된 리비전의 미리보기·원본 파일 id
create function public.field_designs(p_project uuid)
returns table (id uuid, title text, description text, confirmed_version integer,
               original_file_id uuid, preview_file_ids uuid[], preview_labels text[])
language sql stable security definer set search_path = '' as $$
  select d.id, d.title, d.description, d.current_version,
         (select v.file_id from public.design_versions v
           where v.design_id = d.id and v.version_no = d.current_version),
         coalesce((select array_agg(pv.file_id order by pv.created_at)
                   from public.design_previews pv
                   left join public.design_versions v on v.id = pv.design_version_id
                   where pv.design_id = d.id and pv.archived_at is null
                     and (pv.design_version_id is null or v.version_no = d.current_version)), '{}'),
         coalesce((select array_agg(pv.label order by pv.created_at)
                   from public.design_previews pv
                   left join public.design_versions v on v.id = pv.design_version_id
                   where pv.design_id = d.id and pv.archived_at is null
                     and (pv.design_version_id is null or v.version_no = d.current_version)), '{}')
  from public.designs d
  where d.project_id = p_project and d.archived_at is null and d.confirm_state = 'confirmed'
    and private.field_sees(p_project, 'designs')
  order by d.title
$$;

-- F2 확정 자재 (단가는 주지 않는다)
create function public.field_materials(p_project uuid)
returns table (id uuid, name text, category text, space public.material_space, spec text,
               quantity numeric, unit text, location_note text, image_file_id uuid)
language sql stable security definer set search_path = '' as $$
  select m.id, m.name, m.category, m.space, m.spec, m.quantity, m.unit, m.location_note, m.image_file_id
  from public.materials m
  where m.project_id = p_project and m.archived_at is null and m.confirm_state = 'confirmed'
    and private.field_sees(p_project, 'materials')
  order by m.space, m.name
$$;

-- ---------------------------------------------------------------------
-- 3. 파일 열람: 시공팀이 볼 수 있는 확정 도안·자재 파일
-- ---------------------------------------------------------------------
create function private.field_can_view_owner(p_owner_type text, p_owner_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_owner_type
    when 'design_previews' then exists (
      select 1 from public.design_previews pv
      join public.designs d on d.id = pv.design_id
      left join public.design_versions v on v.id = pv.design_version_id
      where pv.id = p_owner_id and pv.archived_at is null and d.archived_at is null
        and d.confirm_state = 'confirmed'
        and (pv.design_version_id is null or v.version_no = d.current_version)
        and private.field_sees(d.project_id, 'designs'))
    when 'design_versions' then exists (
      select 1 from public.design_versions v
      join public.designs d on d.id = v.design_id
      where v.id = p_owner_id and d.archived_at is null and d.confirm_state = 'confirmed'
        and v.version_no = d.current_version and private.field_sees(d.project_id, 'designs'))
    when 'materials' then exists (
      select 1 from public.materials m
      where m.id = p_owner_id and m.archived_at is null and m.confirm_state = 'confirmed'
        and private.field_sees(m.project_id, 'materials'))
    else false end
$$;

-- 20261013000120_a_file_visibility.sql 의 함수에 시공팀 분기 한 줄을 더한다 (나머지는 그대로)
create or replace function private.can_view_file(p_file public.files) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_file.status <> 'ready' then
    return p_file.uploaded_by = auth.uid();
  end if;
  if p_file.kind = 'company_logo' then
    return private.can_see_company(p_file.company_id);
  end if;
  if p_file.project_id is null then return false; end if;
  if private.can_edit_project(p_file.project_id) then return true; end if;
  if p_file.owner_id is null then
    return p_file.uploaded_by = auth.uid();
  end if;
  if private.field_can_view_owner(p_file.owner_type, p_file.owner_id) then return true; end if;   -- F2
  return private.can_view_owner(p_file.owner_type, p_file.owner_id);
end $$;

-- ---------------------------------------------------------------------
-- 4. 사진 (F8·F9)
-- ---------------------------------------------------------------------

-- F8: 시공팀은 같은 현장의 보관 안 된 사진 + 본인이 보관한 사진(보관 직후 행 확인용)을 본다. 목록은 앱이 보관분을 거른다
create or replace function private.row_visible_photos(p public.photos) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_edit_project(p.project_id)
      or (private.is_field_on(p.project_id)
          and (p.archived_at is null or p.uploaded_by = (select auth.uid())))   -- POL-005, F8
      or (p.is_public and p.archived_at is null and private.can_view_as_customer(p.project_id))
$$;

-- F9: 시공팀 사진은 숨김으로 저장. 담당자가 '바로 공개'를 켠 현장만 공개로 저장
create or replace function private.photo_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.uploaded_by := auth.uid();
  if private.can_edit_project(new.project_id) then
    new.uploader_role := 'staff';
  else
    new.uploader_role := 'field';
    new.is_public := coalesce((select s.photo_auto_public from public.project_field_settings s
                               where s.project_id = new.project_id), false);
  end if;
  return new;
end $$;

-- F8: 시공팀은 본인 사진만 고치고, 공개 여부는 못 바꾸며, 보관(숨김)은 공개 전 본인 사진만 (되돌리기 없음)
create or replace function private.photo_before_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_edit_project(old.project_id) and not private.is_system_context() then
    if old.uploaded_by <> auth.uid() then
      raise exception 'forbidden' using errcode = 'P0001';
    end if;
    if new.is_public is distinct from old.is_public then
      raise exception 'forbidden' using errcode = 'P0001';
    end if;
    if new.archived_at is distinct from old.archived_at
       and (old.archived_at is not null or old.is_public or new.archived_at is null) then
      raise exception 'forbidden' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 5. 알림 (F11): 일정 탭이 켜진 현장의 일정 변경 → 시공팀에게도
-- ---------------------------------------------------------------------
create or replace function private.notify_schedule() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_moved boolean := tg_op = 'INSERT'
    or (new.start_date, new.start_time, new.end_date, new.end_time)
       is distinct from (old.start_date, old.start_time, old.end_date, old.end_time);
begin
  if new.is_public and new.archived_at is null and (v_moved or (tg_op = 'UPDATE' and not old.is_public)) then
    perform private.notify_participants(new.project_id, 'customer', 'schedule_changed', 'schedule_events', new.id);
  end if;
  if new.archived_at is null and v_moved and exists (
       select 1 from public.project_field_settings s
       where s.project_id = new.project_id and s.show_schedule) then
    perform private.notify_participants(new.project_id, 'field', 'schedule_changed', 'schedule_events', new.id);
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 6. 권한 (a_grants_hardening 규칙 반복)
-- ---------------------------------------------------------------------
revoke all on public.project_field_settings from anon;
revoke all on public.project_field_settings from authenticated;
grant select, insert, update on public.project_field_settings to authenticated;

revoke execute on function private.field_settings_defaults(), private.field_sees(uuid, text),
  private.field_can_view_owner(text, uuid) from public, anon;
grant execute on function private.field_settings_defaults(), private.field_sees(uuid, text),
  private.field_can_view_owner(text, uuid) to authenticated, service_role;

revoke execute on function public.field_sites(), public.field_site(uuid), public.field_schedule(uuid),
  public.field_designs(uuid), public.field_materials(uuid) from public, anon;
grant execute on function public.field_sites(), public.field_site(uuid), public.field_schedule(uuid),
  public.field_designs(uuid), public.field_materials(uuid) to authenticated;

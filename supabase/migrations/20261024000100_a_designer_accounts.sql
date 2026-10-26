-- =====================================================================
-- 20261024000100_a_designer_accounts.sql
-- 소유: A · 디자이너 페이지 2단계 (D-10~D-17) — CR-1·CR-2·CR-7
--  1) 업체 상태(대기·승인·정지): 셀프 가입 업체는 '대기'로 시작, 사이트 관리자가 승인해야 사용 (D-10·D-11)
--     승인되지 않은 업체의 구성원·참여자는 모든 권한 판정에서 빠진다 (member_role_for·has_participation_for)
--  2) 첫 로그인 비밀번호 변경: profiles.must_change_password · temp_password_expires_at (D-15·D-16)
--  3) 디자이너가 만든 고객·시공팀 계정을 프로젝트에 배정하는 RPC (D-12) — 초대 링크 대체
-- 기존 행: 업체는 'approved' 로 채운다 (지금 쓰는 업체가 막히지 않도록)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 업체 상태
-- ---------------------------------------------------------------------
alter table public.companies
  add column status text not null default 'approved'
  check (status in ('pending', 'approved', 'suspended'));

-- 상태는 시스템(사이트 관리자·RPC)만 바꾼다
create trigger system_cols before update on public.companies
  for each row execute function private.guard_system_columns('status');

-- 승인된 업체의 구성원만 구성원으로 본다 (is_company_staff·manager·owner·can_edit_project 가 모두 이 함수를 쓴다)
create or replace function private.member_role_for(p_user uuid, p_company uuid) returns public.member_role
language sql stable security definer set search_path = '' as $$
  select m.role from public.company_members m
  join public.companies c on c.id = m.company_id
  where m.company_id = p_company and m.user_id = p_user and m.removed_at is null
    and c.status = 'approved'
$$;

-- 승인된 업체의 프로젝트에서만 배정이 유효하다 (정지된 업체의 고객·시공팀도 차단)
create or replace function private.has_participation_for(p_user uuid, p_project uuid, p_role public.participant_role)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_participants pp
    join public.companies c on c.id = pp.company_id
    where pp.project_id = p_project and pp.user_id = p_user and pp.role = p_role
      and pp.revoked_at is null
      and c.status = 'approved'
      and (pp.valid_from  is null or pp.valid_from  <= private.today_kst())
      and (pp.valid_until is null or pp.valid_until >= private.today_kst())
  )
$$;

-- 셀프 가입: 업체를 '대기'로 만든다 (나머지는 기존과 같음)
create or replace function public.create_company_with_owner(
  p_user uuid, p_company_name text, p_slug text, p_display_name text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_company uuid;
begin
  perform set_config('app.system_write', 'on', true);
  insert into public.companies (slug, name, created_by, status)
  values (lower(p_slug), p_company_name, p_user, 'pending')
  returning id into v_company;
  insert into public.company_settings (company_id) values (v_company);
  insert into public.company_members (company_id, user_id, role) values (v_company, p_user, 'owner');
  update public.profiles set display_name = left(p_display_name, 80) where id = p_user;
  perform set_config('app.system_write', 'off', true);
  return v_company;
exception when unique_violation then
  raise exception 'slug_taken' using errcode = 'P0001';
end $$;

-- 내 업체 중 아직 쓸 수 없는 업체 (승인 대기·정지 안내용). 구성원 본인만 자기 것을 본다
create function public.my_inactive_companies()
returns table (id uuid, name text, status text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.status
  from public.company_members m
  join public.companies c on c.id = m.company_id
  where m.user_id = (select auth.uid()) and m.removed_at is null and c.status <> 'approved'
  order by c.created_at
$$;

-- 사이트 관리자 전용 — 업체 승인·정지 (service_role 만 실행)
create function public.set_company_status(p_company uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('pending', 'approved', 'suspended') then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  perform set_config('app.system_write', 'on', true);
  update public.companies set status = p_status where id = p_company;
  if not found then raise exception 'project_not_found' using errcode = 'P0001'; end if;
  perform set_config('app.system_write', 'off', true);
end $$;

-- ---------------------------------------------------------------------
-- 2. 첫 로그인 비밀번호 변경
-- ---------------------------------------------------------------------
alter table public.profiles
  add column must_change_password boolean not null default false,
  add column temp_password_expires_at timestamptz;

-- 사용자가 스스로 표시를 지우지 못한다 (서버가 비밀번호 변경을 확인한 뒤 service_role 로만 바꾼다)
create trigger system_cols before update on public.profiles
  for each row execute function private.guard_system_columns('must_change_password', 'temp_password_expires_at');

-- ---------------------------------------------------------------------
-- 3. 디자이너가 만든 고객·시공팀 계정을 프로젝트에 배정 (D-12)
--    호출자 = 디자이너 세션(편집 권한 필요). 대상은 이메일로 찾는다 (서버가 방금 만들었거나 이미 있는 계정)
--    이미 배정(회수 포함)이 있으면 기간·확정권을 새로 쓰고 다시 유효하게 만든다
-- ---------------------------------------------------------------------
create function public.assign_external_participant(
  p_project uuid,
  p_email text,
  p_role public.participant_role,
  p_can_confirm boolean,
  p_valid_from date,
  p_valid_until date
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_company uuid;
  v_id uuid;
begin
  if p_role not in ('customer', 'field') then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  if not private.can_edit_project(p_project) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  select u.id into v_user from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;
  -- 같은 업체 구성원(디자이너)은 고객·시공팀으로 배정하지 않는다
  select p.company_id into v_company from public.projects p where p.id = p_project;
  if private.member_role_for(v_user, v_company) is not null then
    raise exception 'scope_mismatch' using errcode = 'P0001';
  end if;

  insert into public.project_participants
    (project_id, company_id, user_id, role, can_confirm, valid_from, valid_until, invited_by)
  values
    (p_project, v_company, v_user, p_role, p_role = 'customer' and coalesce(p_can_confirm, false),
     p_valid_from, p_valid_until, (select auth.uid()))
  on conflict (project_id, user_id, role) do update
    set revoked_at  = null,
        can_confirm = excluded.can_confirm,
        valid_from  = excluded.valid_from,
        valid_until = excluded.valid_until
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.my_inactive_companies() from public, anon;
revoke all on function public.set_company_status(uuid, text) from public, anon, authenticated;
revoke all on function public.assign_external_participant(uuid, text, public.participant_role, boolean, date, date) from public, anon;
grant execute on function public.my_inactive_companies() to authenticated;
grant execute on function public.set_company_status(uuid, text) to service_role;
grant execute on function public.assign_external_participant(uuid, text, public.participant_role, boolean, date, date) to authenticated;

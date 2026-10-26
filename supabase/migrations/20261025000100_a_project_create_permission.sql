-- =====================================================================
-- 20261025000100_a_project_create_permission.sql
-- 소유: A · 디자이너 페이지 D-36 (업체관리자 CA-07) — CR-9
--  - 프로젝트 생성: 업체관리자(owner·manager)는 항상, 담당자(pm)는 '생성 권한'이 있을 때만
--  - 담당자는 권한을 요청하고, 업체관리자가 승인·거절한다 (승인하면 권한이 켜진다)
--  - 업체관리자는 요청 없이도 담당자별로 권한을 켜고 끌 수 있다
-- 기존 담당자(pm)도 기본값은 '권한 없음' — 업체관리자가 켜야 만들 수 있다 (새 정책)
-- =====================================================================

alter table public.company_members
  add column can_create_projects boolean not null default false;

-- 담당자 본인이나 소유자의 일반 수정으로 바꾸지 못하게 (RPC 안에서만)
create trigger guard_create_permission before update on public.company_members
  for each row execute function private.guard_system_columns('can_create_projects');

-- 생성 가능 여부 (RLS · 화면 공통)
create function private.can_create_project_for(p_user uuid, p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    private.member_role_for(p_user, p_company) in ('owner', 'manager')
    or exists (
      select 1 from public.company_members m
      where m.company_id = p_company and m.user_id = p_user and m.removed_at is null
        and m.role = 'pm' and m.can_create_projects
        and private.member_role_for(p_user, p_company) is not null),
    false)
$$;
create function private.can_create_project(p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_create_project_for((select auth.uid()), p_company)
$$;

drop policy projects_insert on public.projects;
create policy projects_insert on public.projects for insert to authenticated
  with check (private.can_create_project(company_id) and created_by = (select auth.uid()));

-- 권한 요청
create table public.project_create_requests (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id),
  user_id      uuid not null references auth.users(id),
  note         text not null default '' check (char_length(note) <= 500),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by   uuid references auth.users(id),
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);
create unique index project_create_requests_one_pending
  on public.project_create_requests (company_id, user_id) where status = 'pending';
alter table public.project_create_requests enable row level security;

-- 본인 요청 + 업체관리자는 업체 전체 요청을 본다. 쓰기는 RPC 전용
create policy project_create_requests_select on public.project_create_requests for select to authenticated
  using (user_id = (select auth.uid()) or private.is_company_manager(company_id));
grant select on public.project_create_requests to authenticated;
revoke insert, update, delete on public.project_create_requests from authenticated, anon;

-- 담당자: 생성 권한 요청 (이미 있거나 대기 중이면 그대로 둔다)
create function public.request_project_create(p_company uuid, p_note text default '')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if private.member_role_for(auth.uid(), p_company) is distinct from 'pm' then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if private.can_create_project_for(auth.uid(), p_company) then
    raise exception 'already_allowed' using errcode = 'P0001';
  end if;
  select r.id into v_id from public.project_create_requests r
   where r.company_id = p_company and r.user_id = auth.uid() and r.status = 'pending';
  if v_id is not null then return v_id; end if;
  insert into public.project_create_requests (company_id, user_id, note)
  values (p_company, auth.uid(), coalesce(left(p_note, 500), ''))
  returning id into v_id;
  return v_id;
end $$;

-- 업체관리자: 담당자 권한 켜기·끄기 (대기 중 요청은 함께 처리)
create function public.set_project_create_permission(p_member uuid, p_allowed boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_user uuid; v_role public.member_role;
begin
  select m.company_id, m.user_id, m.role into v_company, v_user, v_role
    from public.company_members m where m.id = p_member and m.removed_at is null;
  if v_company is null or not private.is_company_manager(v_company) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if v_role <> 'pm' then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  perform set_config('app.system_write', 'on', true);
  update public.company_members set can_create_projects = p_allowed where id = p_member;
  perform set_config('app.system_write', 'off', true);
  update public.project_create_requests
     set status = case when p_allowed then 'approved' else 'rejected' end,
         decided_by = auth.uid(), decided_at = now()
   where company_id = v_company and user_id = v_user and status = 'pending';
end $$;

-- 업체관리자: 요청 승인·거절
create function public.decide_project_create_request(p_request uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_user uuid; v_member uuid;
begin
  select r.company_id, r.user_id into v_company, v_user
    from public.project_create_requests r where r.id = p_request and r.status = 'pending';
  if v_company is null or not private.is_company_manager(v_company) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  update public.project_create_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(), decided_at = now()
   where id = p_request;
  if p_approve then
    select m.id into v_member from public.company_members m
     where m.company_id = v_company and m.user_id = v_user and m.removed_at is null and m.role = 'pm';
    if v_member is not null then
      perform set_config('app.system_write', 'on', true);
      update public.company_members set can_create_projects = true where id = v_member;
      perform set_config('app.system_write', 'off', true);
    end if;
  end if;
end $$;

revoke all on function public.request_project_create(uuid, text) from public, anon;
revoke all on function public.set_project_create_permission(uuid, boolean) from public, anon;
revoke all on function public.decide_project_create_request(uuid, boolean) from public, anon;
grant execute on function public.request_project_create(uuid, text) to authenticated;
grant execute on function public.set_project_create_permission(uuid, boolean) to authenticated;
grant execute on function public.decide_project_create_request(uuid, boolean) to authenticated;

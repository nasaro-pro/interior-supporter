-- =====================================================================
-- 20261108000300_a_portfolio_permission.sql
-- 소유: A · 포트폴리오 권한 (프로젝트 생성 권한 D-36 과 같은 방식)
--  - 대표·관리자(owner·manager): 항상 '전체 관리'
--  - 담당자(pm): 업체관리자가 정한 단계만 — none(기본) / works(사례 올리기) / full(전체 관리)
--      works: 자기 담당 프로젝트(유효한 pm 참여)로 '초안' 사례를 만들고 고친다 (사진·공간·비포/애프터·고객 동의 기록)
--             공개·비공개, 대표 지정, 순서, 공개된 사례 수정, 홈페이지 설정은 못 한다
--      full : 대표·관리자와 같다 (다른 사람 권한 바꾸기만 빼고)
--  - 담당자는 단계를 요청하고(사례 올리기 / 전체 관리), 업체관리자가 승인·거절하거나 요청 없이 바로 정한다
-- 기존 담당자도 기본값은 none — 업체관리자가 정해야 탭이 보인다
-- =====================================================================

alter table public.company_members
  add column portfolio_access text not null default 'none'
    check (portfolio_access in ('none', 'works', 'full'));

-- 일반 수정으로 바꾸지 못하게 (RPC 안에서만). 새로 들어오는 구성원은 언제나 none 으로 시작
create trigger guard_portfolio_permission before update on public.company_members
  for each row execute function private.guard_system_columns('portfolio_access');

create function private.portfolio_access_on_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not private.is_system_context() then new.portfolio_access := 'none'; end if;
  return new;
end $$;
create trigger portfolio_access_default before insert on public.company_members
  for each row execute function private.portfolio_access_on_insert();

-- ---------------------------------------------------------------------
-- 판정 함수 (RLS · 트리거 · 화면 공통)
-- ---------------------------------------------------------------------

/* 이 사람의 이 업체 포트폴리오 단계: 'full' | 'works' | 'none' | null(직원 아님) */
create function private.portfolio_level_for(p_user uuid, p_company uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when r in ('owner', 'manager') then 'full'
    when r = 'pm' then coalesce((
      select m.portfolio_access from public.company_members m
       where m.company_id = p_company and m.user_id = p_user and m.removed_at is null), 'none')
    else null end
  from (select private.member_role_for(p_user, p_company) as r) x
$$;
create function private.portfolio_level(p_company uuid) returns text
language sql stable security definer set search_path = '' as $$
  select private.portfolio_level_for((select auth.uid()), p_company)
$$;

/* 이 사례(업체·원본 프로젝트·상태)를 지금 사람이 쓸 수 있나 */
create function private.portfolio_can_edit_work(p_company uuid, p_project uuid, p_status public.portfolio_status)
returns boolean
language sql stable security definer set search_path = '' as $$
  select case private.portfolio_level(p_company)
    when 'full' then true
    when 'works' then p_status = 'draft' and p_project is not null and exists (
      select 1 from public.project_participants pp
       where pp.project_id = p_project and pp.company_id = p_company
         and pp.user_id = (select auth.uid()) and pp.role = 'pm' and pp.revoked_at is null
         and (pp.valid_from  is null or pp.valid_from  <= private.today_kst())
         and (pp.valid_until is null or pp.valid_until >= private.today_kst()))
    else false end
$$;

-- ---------------------------------------------------------------------
-- 사례 트리거 보강: '사례 올리기' 단계는 공개·대표·순서를 못 바꾼다 (화면에서 숨겨도 DB 가 다시 막음)
-- ---------------------------------------------------------------------
create function private.portfolio_work_level_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or private.portfolio_level(new.company_id) = 'full' then
    return new; -- 서버(service_role)·전체 관리
  end if;
  if tg_op = 'INSERT' then
    if new.is_featured or new.status <> 'draft' or new.sort_order <> 0 then
      raise exception 'forbidden' using errcode = 'P0001';
    end if;
  elsif new.is_featured is distinct from old.is_featured
     or new.status is distinct from old.status
     or new.sort_order is distinct from old.sort_order then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return new;
end $$;
-- 기존 check_row 보다 먼저 돈다 (BEFORE 트리거는 이름순: check_level → check_row) → 권한 오류가 먼저 보인다
create trigger check_level before insert or update on public.portfolio_works
  for each row execute function private.portfolio_work_level_check();

-- 사진: '사례 올리기' 단계는 그 사례의 원본 프로젝트 파일만 (다른 집 사진을 끌어오지 못하게)
create function private.portfolio_image_level_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or private.portfolio_level(new.company_id) = 'full' then
    return new;
  end if;
  if not exists (
    select 1 from public.files f join public.portfolio_works w on w.id = new.work_id
     where f.id = new.source_file_id and f.project_id is not distinct from w.project_id
       and w.project_id is not null
  ) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return new;
end $$;
-- a_scope → b_check → c_level 순서
create trigger c_level before insert on public.portfolio_images
  for each row execute function private.portfolio_image_level_check();

-- ---------------------------------------------------------------------
-- RLS 다시 정의 — 읽기는 그대로(직원), 쓰기는 단계에 따라
-- ---------------------------------------------------------------------
drop policy company_portfolios_insert on public.company_portfolios;
drop policy company_portfolios_update on public.company_portfolios;
create policy company_portfolios_insert on public.company_portfolios for insert to authenticated
  with check (private.portfolio_level(company_id) = 'full');
create policy company_portfolios_update on public.company_portfolios for update to authenticated
  using (private.portfolio_level(company_id) = 'full')
  with check (private.portfolio_level(company_id) = 'full');

drop policy portfolio_works_insert on public.portfolio_works;
drop policy portfolio_works_update on public.portfolio_works;
create policy portfolio_works_insert on public.portfolio_works for insert to authenticated
  with check (private.portfolio_can_edit_work(company_id, project_id, status)
              and created_by = (select auth.uid()));
create policy portfolio_works_update on public.portfolio_works for update to authenticated
  using (private.portfolio_can_edit_work(company_id, project_id, status))
  with check (private.portfolio_can_edit_work(company_id, project_id, status));

drop policy portfolio_images_insert on public.portfolio_images;
drop policy portfolio_images_update on public.portfolio_images;
create policy portfolio_images_insert on public.portfolio_images for insert to authenticated
  with check (exists (select 1 from public.portfolio_works w
                       where w.id = work_id and w.company_id = portfolio_images.company_id
                         and private.portfolio_can_edit_work(w.company_id, w.project_id, w.status)));
create policy portfolio_images_update on public.portfolio_images for update to authenticated
  using (exists (select 1 from public.portfolio_works w
                  where w.id = work_id
                    and private.portfolio_can_edit_work(w.company_id, w.project_id, w.status)))
  with check (exists (select 1 from public.portfolio_works w
                       where w.id = work_id
                         and private.portfolio_can_edit_work(w.company_id, w.project_id, w.status)));

-- ---------------------------------------------------------------------
-- 권한 요청 (project_create_requests 와 같은 모양 + 요청 단계)
-- ---------------------------------------------------------------------
create table public.portfolio_access_requests (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id),
  user_id      uuid not null references auth.users(id),
  level        text not null check (level in ('works', 'full')),
  note         text not null default '' check (char_length(note) <= 500),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by   uuid references auth.users(id),
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);
create unique index portfolio_access_requests_one_pending
  on public.portfolio_access_requests (company_id, user_id) where status = 'pending';
alter table public.portfolio_access_requests enable row level security;
create policy portfolio_access_requests_select on public.portfolio_access_requests for select to authenticated
  using (user_id = (select auth.uid()) or private.is_company_manager(company_id));
grant select on public.portfolio_access_requests to authenticated;
revoke insert, update, delete on public.portfolio_access_requests from authenticated, anon;

-- 담당자: 단계 요청 (대기 중이면 단계만 바꿔 그대로 둔다)
create function public.request_portfolio_access(p_company uuid, p_level text, p_note text default '')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_now text;
begin
  if private.member_role_for(auth.uid(), p_company) is distinct from 'pm' then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if p_level not in ('works', 'full') then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  v_now := private.portfolio_level_for(auth.uid(), p_company);
  if v_now = p_level or v_now = 'full' then
    raise exception 'already_allowed' using errcode = 'P0001';
  end if;
  select r.id into v_id from public.portfolio_access_requests r
   where r.company_id = p_company and r.user_id = auth.uid() and r.status = 'pending';
  if v_id is not null then
    update public.portfolio_access_requests set level = p_level, note = coalesce(left(p_note, 500), '')
     where id = v_id;
    return v_id;
  end if;
  insert into public.portfolio_access_requests (company_id, user_id, level, note)
  values (p_company, auth.uid(), p_level, coalesce(left(p_note, 500), ''))
  returning id into v_id;
  return v_id;
end $$;

-- 업체관리자: 담당자 단계 정하기 (대기 요청은 함께 처리: 정한 단계가 요청 이상이면 승인, 아니면 거절)
create function public.set_portfolio_access(p_member uuid, p_level text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_user uuid; v_role public.member_role;
begin
  select m.company_id, m.user_id, m.role into v_company, v_user, v_role
    from public.company_members m where m.id = p_member and m.removed_at is null;
  if v_company is null or not private.is_company_manager(v_company) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if v_role <> 'pm' or p_level not in ('none', 'works', 'full') then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  perform set_config('app.system_write', 'on', true);
  update public.company_members set portfolio_access = p_level where id = p_member;
  perform set_config('app.system_write', 'off', true);
  update public.portfolio_access_requests
     set status = case when p_level = 'full' or p_level = level then 'approved' else 'rejected' end,
         decided_by = auth.uid(), decided_at = now()
   where company_id = v_company and user_id = v_user and status = 'pending';
end $$;

-- 업체관리자: 요청 승인(요청한 단계로) · 거절
create function public.decide_portfolio_access_request(p_request uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_user uuid; v_level text; v_member uuid;
begin
  select r.company_id, r.user_id, r.level into v_company, v_user, v_level
    from public.portfolio_access_requests r where r.id = p_request and r.status = 'pending';
  if v_company is null or not private.is_company_manager(v_company) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  update public.portfolio_access_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(), decided_at = now()
   where id = p_request;
  if p_approve then
    select m.id into v_member from public.company_members m
     where m.company_id = v_company and m.user_id = v_user and m.removed_at is null and m.role = 'pm';
    if v_member is not null then
      perform set_config('app.system_write', 'on', true);
      update public.company_members set portfolio_access = v_level where id = v_member;
      perform set_config('app.system_write', 'off', true);
    end if;
  end if;
end $$;

revoke all on function public.request_portfolio_access(uuid, text, text) from public, anon;
revoke all on function public.set_portfolio_access(uuid, text) from public, anon;
revoke all on function public.decide_portfolio_access_request(uuid, boolean) from public, anon;
grant execute on function public.request_portfolio_access(uuid, text, text) to authenticated;
grant execute on function public.set_portfolio_access(uuid, text) to authenticated;
grant execute on function public.decide_portfolio_access_request(uuid, boolean) to authenticated;
revoke execute on function private.portfolio_level_for(uuid, uuid), private.portfolio_level(uuid),
  private.portfolio_can_edit_work(uuid, uuid, public.portfolio_status),
  private.portfolio_work_level_check(), private.portfolio_image_level_check() from public, anon;
grant execute on function private.portfolio_level_for(uuid, uuid), private.portfolio_level(uuid),
  private.portfolio_can_edit_work(uuid, uuid, public.portfolio_status),
  private.portfolio_work_level_check(), private.portfolio_image_level_check() to authenticated, service_role;

-- =====================================================================
-- 20261108000600_a_portfolio_business_lock.sql
-- 소유: A · 대표자·사업자등록번호 잠금 — 사이트 관리자(운영자)가 확인한 뒤 잠근다
--  business_locked_at : null = 업체가 고칠 수 있음 / 값 = 잠김 (그 시각에 잠금)
--  잠금·풀기는 운영자만 (service_role · private.set_portfolio_business_lock). 업체 화면은 읽기 전용으로 보여 준다
--  지금은 운영자 화면이 없어 SQL 로 부른다. 나중에 사이트 관리자 화면이 이 함수를 부르면 된다
-- =====================================================================

alter table public.company_portfolios
  add column business_locked_at timestamptz;

-- 업체(authenticated)가 저장할 때: 잠금 칸은 손대지 못하고, 잠겨 있으면 대표자·사업자등록번호를 못 바꾼다
create function private.portfolio_business_lock_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.is_system_context() then return new; end if;
  if tg_op = 'INSERT' then
    new.business_locked_at := null; -- 처음 만들 때 잠근 채로 넣지 못한다
    return new;
  end if;
  if new.business_locked_at is distinct from old.business_locked_at then
    raise exception 'system_column:business_locked_at' using errcode = 'P0001'; -- 잠금·풀기는 운영자만
  end if;
  if old.business_locked_at is not null
     and (new.representative is distinct from old.representative
          or new.business_reg_no is distinct from old.business_reg_no) then
    raise exception 'business_locked' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger check_business_lock before insert or update on public.company_portfolios
  for each row execute function private.portfolio_business_lock_check();

-- 사이트 관리자용: 잠그기 / 풀기 (운영자 서버만 부름)
create function private.set_portfolio_business_lock(p_company uuid, p_locked boolean) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare v timestamptz;
begin
  if not private.is_system_context() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  update public.company_portfolios
     set business_locked_at = case when p_locked then now() else null end
   where company_id = p_company
  returning business_locked_at into v;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  return v;
end $$;

revoke all on function private.set_portfolio_business_lock(uuid, boolean) from public, anon, authenticated;
grant execute on function private.set_portfolio_business_lock(uuid, boolean) to service_role;

-- =====================================================================
-- 20261025000300_c_request_target.sql
-- 소유: C · 디자이너 페이지 D-32 · D-33 (고객 페이지 CU-05 · CU-06 과 짝) — CR-6 · CR-7
-- 도안 · 자재 옆 메모: 요청(메모)에 '연결 항목'(도안 또는 자재)을 단다.
--  - 같은 프로젝트의, 보관되지 않은 공개 항목에만 연결 (고객이 보는 항목)
--  - 연결은 만들 때 정하고 바꾸지 않는다 (원문 불변 규칙과 같음)
--  - 열람 · 작성 권한은 기존 requests 정책 그대로 (작성한 고객 본인 + 편집자)
-- =====================================================================

alter table public.requests
  add column target_type text check (target_type in ('designs', 'materials')),
  add column target_id uuid,
  add constraint requests_target_pair check ((target_type is null) = (target_id is null));
create index requests_target_idx on public.requests (project_id, target_type, target_id)
  where target_id is not null;

create function private.request_target_check() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ok boolean;
begin
  if tg_op = 'UPDATE' then
    if new.target_type is distinct from old.target_type or new.target_id is distinct from old.target_id then
      raise exception 'immutable_column:target' using errcode = 'P0001';
    end if;
    return new;
  end if;
  -- 종류 · 짝 오류는 CHECK 제약(23514)이 알린다
  if new.target_id is null or coalesce(new.target_type not in ('designs', 'materials'), true) then return new; end if;
  if new.target_type = 'designs' then
    select exists (select 1 from public.designs d
      where d.id = new.target_id and d.project_id = new.project_id
        and d.archived_at is null and d.is_public) into ok;
  else
    select exists (select 1 from public.materials m
      where m.id = new.target_id and m.project_id = new.project_id
        and m.archived_at is null and m.is_public) into ok;
  end if;
  if not ok then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger b_target before insert or update on public.requests
  for each row execute function private.request_target_check();

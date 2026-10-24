-- =====================================================================
-- 20261013000120_a_file_visibility.sql
-- 소유: A (박예원) · 파트 2 · 결함 DB-07 (중대), DB-09 (일반)
-- DB-07: can_view_file 이 status 를 보지 않아, 같은 프로젝트 편집자가 남이 올린 pending/rejected(검증 전·위장 의심)
--        파일 행을 조회할 수 있었다. → 준비(ready) 전 파일은 업로더 본인만.
--        + 파생 파일(썸네일)이 원본 연결 뒤에 만들어져도 원본의 소유 연결을 상속 (고객·PM 이 썸네일을 못 보는 문제)
-- DB-09: files.status 되돌림(ready/rejected → 다른 값)을 DB 에서 막는다 (ST-004 "되돌림 없음")
-- =====================================================================

create or replace function private.can_view_file(p_file public.files) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_file.status <> 'ready' then
    return p_file.uploaded_by = auth.uid();   -- 업로드 의도·검증 단계는 본인만 (RETURNING 유지)
  end if;
  if p_file.kind = 'company_logo' then
    return private.can_see_company(p_file.company_id);
  end if;
  if p_file.project_id is null then return false; end if;
  if private.can_edit_project(p_file.project_id) then return true; end if;
  if p_file.owner_id is null then
    return p_file.uploaded_by = auth.uid();
  end if;
  return private.can_view_owner(p_file.owner_type, p_file.owner_id);
end $$;

create function private.file_inherit_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.derived_from is not null and new.owner_id is null then
    select f.owner_type, f.owner_id into new.owner_type, new.owner_id
    from public.files f where f.id = new.derived_from;
  end if;
  return new;
end $$;
create trigger a_inherit_owner before insert on public.files
  for each row execute function private.file_inherit_owner();

create function private.file_status_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status <> 'pending' and new.status is distinct from old.status then
    raise exception 'immutable_column:status' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger b_status_guard before update on public.files
  for each row execute function private.file_status_guard();

revoke execute on function private.file_inherit_owner(), private.file_status_guard() from public, anon;
grant execute on function private.file_inherit_owner(), private.file_status_guard() to authenticated, service_role;

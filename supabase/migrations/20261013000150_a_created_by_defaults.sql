-- =====================================================================
-- 20261013000150_a_created_by_defaults.sql
-- 소유: A (박예원) · 파트 2 · 결함 DB-04 (일반)
-- 문제: clients.created_by 가 NOT NULL·기본값 없음 → 앱이 빠뜨리면 23502 → INTERNAL. 테이블마다 규약이 달랐다
--       (projects·materials·schedule·requests 는 트리거가 auth.uid() 로 강제, clients·estimates·design_previews 는 아님).
-- 수정: 공용 트리거 함수 private.set_created_by() 를 만들고 clients 에 적용 (B 는 자기 마이그레이션에서 같은 함수 사용).
-- =====================================================================

create function private.set_created_by() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end $$;
revoke execute on function private.set_created_by() from public, anon;
grant execute on function private.set_created_by() to authenticated, service_role;

create trigger a_created_by before insert on public.clients
  for each row execute function private.set_created_by();

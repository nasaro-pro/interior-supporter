-- =====================================================================
-- 20261013000300_c_request_status_guard.sql
-- 소유: C (이재서) · 파트 2 · 결함 DB-03 (일반)
-- 문제: 요청 상태 전환표(POL-018, ST-200)를 DB 가 강제하지 않는다. requests_update 는 편집자의 모든 status 변경 허용.
--       (서버 액션은 검사하지만 DB 단 방어가 없음 — P-02 이중 검증)
-- 수정: BEFORE UPDATE OF status 트리거로 허용 전환만 통과. 위반은 23514 → mapDbError → VALIDATION_FAILED.
-- 허용: open→in_progress, open→resolved, in_progress→resolved, in_progress→open, resolved→in_progress
-- =====================================================================

create function private.request_status_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status
     and (old.status::text, new.status::text) not in (
       ('open', 'in_progress'), ('open', 'resolved'),
       ('in_progress', 'resolved'), ('in_progress', 'open'),
       ('resolved', 'in_progress')) then
    raise exception 'invalid_status_transition' using errcode = '23514';
  end if;
  return new;
end $$;
revoke execute on function private.request_status_guard() from public, anon;
grant execute on function private.request_status_guard() to authenticated, service_role;

create trigger c_status_guard before update of status on public.requests
  for each row execute function private.request_status_guard();

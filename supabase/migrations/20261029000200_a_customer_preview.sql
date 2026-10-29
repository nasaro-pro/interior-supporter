-- =====================================================================
-- 20261029000200_a_customer_preview.sql
-- 소유: A · 담당자의 '고객 화면 미리보기' (읽기 전용) — CR 필요 (공통 권한 함수 2개 교체)
--
-- 앱이 고객 화면(/portal/projects/<id>)을 미리보기로 그릴 때만 요청 헤더
--   x-customer-preview: <project id>
-- 를 붙인다 (src/shared/lib/supabase/server.ts). 그 요청 안에서 그 프로젝트에 대해서는
--   - private.can_edit_project(p)      → false   (편집자 권한을 내려놓고)
--   - private.can_view_as_customer(p)  → true    (고객 규칙으로 본다)
-- 가 되어, 모든 RLS(도안 · 자재 · 견적 · 사진 · 일정 · 파일 …)가 고객에게 보이는 것만 돌려준다.
--
-- 안전장치
--   1) 헤더를 보낸 사람이 그 프로젝트의 진짜 편집자일 때만 (아니면 헤더 무시)
--   2) 읽기 전용 트랜잭션(PostgREST 의 GET 조회)에서만 — 쓰기 요청에서는 헤더를 무시한다
--   3) 고객에게 보이는 것 ⊂ 편집자에게 보이는 것 → 헤더로 볼 수 있는 범위가 넓어지지 않는다
--   4) 보관된 프로젝트는 미리보기 대상이 아니다. 고객 공개가 꺼져 있어도 미리보기는 된다 (공개 전 점검용)
-- =====================================================================

-- 미리보기 중인 프로젝트 (조건을 모두 만족할 때만, 아니면 null)
create function private.preview_project() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_raw text;
  v_id uuid;
begin
  if coalesce(current_setting('transaction_read_only', true), 'off') <> 'on' then
    return null;
  end if;
  v_raw := nullif(current_setting('request.headers', true), '');
  if v_raw is null or position('x-customer-preview' in v_raw) = 0 then
    return null;
  end if;
  begin
    v_id := (v_raw::json ->> 'x-customer-preview')::uuid;
  exception when others then
    return null;
  end;
  if v_id is null or not private.can_edit_project_for((select auth.uid()), v_id) then
    return null;
  end if;
  return v_id;
end $$;

-- 미리보기 헤더가 아예 없으면 함수를 부르지 않도록 (모든 RLS 가 거치는 길이라 가볍게)
create function private.has_preview_header() returns boolean
language sql stable set search_path = '' as $$
  select position('x-customer-preview' in coalesce(current_setting('request.headers', true), '')) > 0
$$;

-- POL-003 편집 권한 — 미리보기 중인 그 프로젝트에서는 편집자로 보지 않는다
create or replace function private.can_edit_project(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_edit_project_for((select auth.uid()), p_project)
     and (not private.has_preview_header() or private.preview_project() is distinct from p_project)
$$;

-- POL-004 고객 열람 — 미리보기 중인 그 프로젝트는 고객 규칙으로 본다 (보관 프로젝트 제외)
create or replace function private.can_view_as_customer(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project and p.is_public and p.archived_at is null
      and private.has_participation_for((select auth.uid()), p.id, 'customer')
  )
  or (private.has_preview_header()
      and private.preview_project() = p_project
      and exists (select 1 from public.projects p where p.id = p_project and p.archived_at is null))
$$;

revoke all on function private.preview_project() from public, anon;
revoke all on function private.has_preview_header() from public, anon;
grant execute on function private.preview_project() to authenticated;
grant execute on function private.has_preview_header() to authenticated;

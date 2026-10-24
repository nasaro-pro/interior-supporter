-- =====================================================================
-- 20261013000110_a_field_project_scope.sql
-- 소유: A (박예원) · 파트 2 · 결함 DB-05 (중대) · CR-INT-04 (통합 책임자 잠정 승인)
-- 문제: projects_select 가 시공팀(is_field_on)에게 프로젝트 행 전체(안내문·홈 구성·공개 여부·일정·상태)를 연다.
--       문서: 시공팀은 프로젝트 "이름·현장만" (docs/01 권한표, POL-005).
-- 수정:
--   1) projects_select 에서 시공팀 제거 (편집자·고객만 행 조회)
--   2) 시공팀이 필요한 최소 정보는 SECURITY DEFINER RPC 로만 제공
--      - public.project_brief(p_project): 볼 수 있는 사용자(편집자·고객·시공팀)에게 접근 판정용 최소 열
--      - public.field_projects(): 내 유효 배정 현장 목록 (이름·현장 주소)
--   3) files_insert 의 프로젝트 업체 확인 서브쿼리를 DEFINER 함수로 교체
--      (호출자 RLS 로 projects 를 읽으면 시공팀은 null → 사진 업로드가 막히므로 반드시 함께 수정)
-- 앱 영향: core access.ts(loadProject) · participant-target.ts → project_brief, photos field-sites.ts → field_projects
-- =====================================================================

create function private.project_company(p_project uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select company_id from public.projects where id = p_project
$$;
revoke execute on function private.project_company(uuid) from public, anon;
grant execute on function private.project_company(uuid) to authenticated, service_role;

drop policy files_insert on public.files;
create policy files_insert on public.files for insert to authenticated
  with check (
    uploaded_by = (select auth.uid()) and status = 'pending' and owner_id is null
    and case
      when kind = 'company_logo' then project_id is null and private.is_company_manager(company_id)
      when kind in ('photo_original') then
        (private.can_edit_project(project_id) or private.is_field_on(project_id))
        and company_id = private.project_company(project_id)
      when kind = 'photo_thumb' then false   -- 썸네일은 서버가 생성
      else private.can_edit_project(project_id)
        and company_id = private.project_company(project_id)
    end);

drop policy projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (private.can_edit_project(id) or private.can_view_as_customer(id));

-- 접근 판정용 최소 정보 (requireProjectAccess · 알림 해석). 볼 권한이 없으면 0행.
create function public.project_brief(p_project uuid)
returns table (id uuid, company_id uuid, name text, site_address text, is_public boolean, archived_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.company_id, p.name, p.site_address, p.is_public, p.archived_at
  from public.projects p
  where p.id = p_project
    and (private.can_edit_project(p.id) or private.can_view_as_customer(p.id) or private.is_field_on(p.id))
$$;

-- 시공팀 유효 배정 현장 (FW-01 현장 선택). 보관 프로젝트 제외.
create function public.field_projects()
returns table (id uuid, company_id uuid, name text, site_address text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.company_id, p.name, p.site_address
  from public.projects p
  where private.is_field_on(p.id) and p.archived_at is null
  order by p.name
$$;

revoke execute on function public.project_brief(uuid), public.field_projects() from public, anon;
grant execute on function public.project_brief(uuid), public.field_projects() to authenticated;

-- =====================================================================
-- 20261013000140_a_client_projects_archive.sql
-- 소유: A (박예원) · 파트 2 · 결함 DB-08 (일반)
-- 문제: client_projects 에 update 정책·archived_at 이 없어 잘못 연결한 프로젝트를 바꾸거나 풀 수 없다 (REQ-021 "등록·수정").
-- 수정: 연결 해제 = archived_at 설정 (DELETE 없음, P-05). "프로젝트 1개 = 고객 카드 1개" 는 유효 연결 기준 부분 unique.
--       연결 변경 = 기존 연결 보관 후 새 연결 추가.
-- =====================================================================

alter table public.client_projects add column archived_at timestamptz;

alter table public.client_projects
  drop constraint client_projects_project_id_key,
  drop constraint client_projects_client_id_project_id_key;
create unique index client_projects_active_project on public.client_projects (project_id) where archived_at is null;
create unique index client_projects_active_pair on public.client_projects (client_id, project_id) where archived_at is null;

create trigger immutable before update on public.client_projects
  for each row execute function private.guard_immutable('company_id', 'client_id', 'project_id', 'created_at');
-- 감사 기록 트리거(audit, insert·update)는 베이스라인에 이미 있다 → 보관(archived) 이벤트도 자동 기록

create policy client_projects_update on public.client_projects for update to authenticated
  using (private.can_edit_project(project_id)) with check (private.can_edit_project(project_id));

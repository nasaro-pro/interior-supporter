-- =====================================================================
-- 20261006000900_a_grants_hardening.sql
-- 소유: A (박예원) · 베이스라인(동결) · 관련: SEC-001~006 (docs/03_아키텍처_데이터_보안.md)
-- 내용: anon 차단, DELETE 권한 제거, 함수 실행 권한 최소화, 이후 생성 객체 기본 권한
-- B·C 가 이후 새 테이블/함수를 만들면 자기 마이그레이션 끝에 같은 GRANT/REVOKE 블록을 반복한다.
-- =====================================================================

-- 1) anon(비로그인)은 어떤 테이블에도 접근하지 않는다. 공개 페이지는 DB 를 읽지 않는다.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;

-- 2) authenticated: 조회·추가·수정만. 물리 삭제 없음 (POL-020). RLS 가 행 단위로 다시 제한
revoke all on all tables in schema public from authenticated;
grant select, insert, update on all tables in schema public to authenticated;
revoke insert, update on public.audit_events from authenticated;          -- 트리거만 기록
revoke insert on public.notifications, public.confirmations, public.design_versions,
                 public.companies, public.company_settings, public.company_members from authenticated;

-- 3) 함수: 기본 PUBLIC 실행 권한 제거 후 필요한 것만 부여
revoke execute on all functions in schema public  from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon;

-- RLS 정책이 호출하는 헬퍼는 authenticated 가 실행할 수 있어야 한다 (private 스키마는 API 미노출)
grant usage on schema private to authenticated, service_role;
grant execute on all functions in schema private to authenticated, service_role;

-- 사용자 호출 RPC
grant execute on function public.create_design(uuid, text, text, uuid, text, boolean)  to authenticated;
grant execute on function public.add_design_version(uuid, uuid, text)                   to authenticated;
grant execute on function public.confirm_target(text, uuid, integer)                    to authenticated;
grant execute on function public.request_reconfirm(text, uuid, text)                    to authenticated;
grant execute on function public.company_storage_usage(uuid)                            to authenticated;

-- 서버(service_role) 전용 RPC
grant execute on function public.create_company_with_owner(uuid, text, text, text) to service_role;
grant execute on function public.accept_invitation(uuid, text)                     to service_role;
grant execute on function public.can_issue_password_reset(uuid, uuid, uuid)        to service_role;

-- 4) 이후 생성되는 객체의 기본 권한 (postgres 역할로 실행되는 마이그레이션 기준)
alter default privileges for role postgres in schema public revoke all on tables    from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke delete, truncate, references, trigger on tables from authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- a_site_admin.test.sql
-- 사이트 관리 검증 — 통합본 3장 A1~A10 (20261026000100_a_site_admin.sql)
-- 실행: npm run db:test (Supabase CLI test db). 트랜잭션 안에서 실행 후 롤백.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;
select * from no_plan();

-- ---- 최소 시드: admin1 = 사이트 관리자 / owner1 = 업체1 소유자 / mgr1 = 업체1 매니저 / cust1 = P1 고객 ----
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'admin1@test.local', '{"display_name":"관리자"}'),
  ('a0000000-0000-0000-0000-000000000002', 'owner1@test.local', '{"display_name":"소유자"}'),
  ('a0000000-0000-0000-0000-000000000003', 'mgr1@test.local',   '{"display_name":"매니저"}'),
  ('a0000000-0000-0000-0000-000000000004', 'cust1@test.local',  '{"display_name":"고객"}');
insert into public.platform_admins (user_id) values ('a0000000-0000-0000-0000-000000000001');
insert into public.companies (id, slug, name, created_by) values
  ('c0000000-0000-0000-0000-000000000001', 'studio-one', '스튜디오 원', 'a0000000-0000-0000-0000-000000000002');
insert into public.company_settings (company_id) values ('c0000000-0000-0000-0000-000000000001');
insert into public.company_members (company_id, user_id, role) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'owner'),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'manager');
insert into public.projects (id, company_id, name, is_public, created_by) values
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '현장', true, 'a0000000-0000-0000-0000-000000000002');
insert into public.project_participants (project_id, company_id, user_id, role) values
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'customer');
insert into public.files (id, company_id, project_id, kind, path, original_name, mime, size_bytes, status, uploaded_by) values
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'photo_original', 'test/rejected.jpg', 'rejected.jpg', 'image/jpeg', 100, 'rejected', 'a0000000-0000-0000-0000-000000000002');
insert into public.notifications (recipient_id, company_id, type, object_type, object_id, read_at) values
  ('a0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'photo_published', 'photos',
   'e0000000-0000-0000-0000-000000000001', now() - interval '100 days'),
  ('a0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'photo_published', 'photos',
   'e0000000-0000-0000-0000-000000000001', now() - interval '10 days');

set local role authenticated;

-- ===== A1 관리자 판별 =====
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select ok(public.is_platform_admin(), 'A1 등록된 관리자 = true');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select ok(not public.is_platform_admin(), 'A1 업체 소유자도 관리자 아님');
select throws_ok($$ select * from public.admin_dashboard() $$, 'P0001', 'forbidden', 'A1 비관리자 대시보드 거부');
select throws_ok($$ select public.admin_change_company_owner('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003') $$,
  'P0001', 'forbidden', 'A4 비관리자 소유자 변경 거부');
select is((select count(*) from public.admin_audit_events), 0::bigint, 'A8 비관리자는 관리 기록 0행');

-- ===== A3 대시보드 · A4 업체 =====
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select ok((select companies = 1 and projects = 1 and users = 4 from public.admin_dashboard()), 'A3 업체·프로젝트·사용자 수');
select ok((select owner_name = '소유자' and member_count = 2 from public.admin_companies('studio')), 'A4 업체 목록 소유자·구성원 수');
select is_empty($$ select * from public.admin_companies('없는업체') $$, 'A4 검색 불일치 0행');

select lives_ok($$ select public.admin_change_company_owner('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003') $$,
  'A4 소유자 변경');
reset role;
select is((select role::text from public.company_members where user_id = 'a0000000-0000-0000-0000-000000000003'), 'owner', 'A4 새 소유자');
select is((select role::text from public.company_members where user_id = 'a0000000-0000-0000-0000-000000000002'), 'manager', 'A4 이전 소유자는 manager');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$ select public.admin_change_company_owner('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004') $$,
  'P0001', 'not_member', 'A4 구성원이 아니면 소유자 불가');

-- ===== A5 정지 · 익명화 =====
select lives_ok($$ select public.admin_set_user_suspended('a0000000-0000-0000-0000-000000000004', true) $$, 'A5 정지');
select ok((select suspended_at is not null from public.admin_users('cust1@')), 'A5 정지 표시');
select throws_ok($$ select public.admin_set_user_suspended('a0000000-0000-0000-0000-000000000001', true) $$,
  'P0001', 'self_target', 'A5 본인 정지 거부');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select throws_ok($$ update public.profiles set suspended_at = null where id = 'a0000000-0000-0000-0000-000000000004' $$,
  'P0001', 'forbidden', 'A5 본인 프로필로 정지 해제 불가');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$ select public.admin_anonymize_user('a0000000-0000-0000-0000-000000000003') $$,
  'P0001', 'sole_owner', 'A5 업체의 유일한 소유자는 익명화 불가');
select lives_ok($$ select public.admin_anonymize_user('a0000000-0000-0000-0000-000000000004') $$, 'A5 익명화');
reset role;
select is((select display_name from public.profiles where id = 'a0000000-0000-0000-0000-000000000004'), '탈퇴한 사용자', 'A5 이름 익명화');
select is_empty($$ select 1 from public.project_participants where user_id = 'a0000000-0000-0000-0000-000000000004' and revoked_at is null $$,
  'A5 익명화하면 프로젝트 참여 회수');
set local role authenticated;

-- ===== A10 본인 탈퇴 =====
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select throws_ok($$ select public.withdraw_me() $$, 'P0001', 'sole_owner', 'A10 유일한 소유자는 탈퇴 불가');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok($$ select public.withdraw_me() $$, 'A10 매니저 본인 탈퇴');

-- ===== A6 사이트 설정 =====
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select ok((select photo_max_bytes = 20971520 and photo_batch_max = 20 from public.site_settings), 'A6 누구나 한도 읽기');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$ update public.site_settings set photo_batch_max = 5 $$, '42501', null, 'A6 직접 수정 거부(관리자도 RPC 로만)');
select lives_ok($$ select public.admin_update_site_settings(10485760, 30, 52428800, null) $$, 'A6 설정 변경');
select is((select photo_batch_max from public.site_settings), 30, 'A6 변경 반영');
select throws_ok($$ select public.admin_update_site_settings(10, 30, 52428800, null) $$, '23514', null, 'A6 범위 밖 값 거부');
select lives_ok($$ select public.admin_set_company_quota('c0000000-0000-0000-0000-000000000001', 1073741824) $$, 'A6 업체 한도');
select is((select quota_bytes from public.admin_companies(null)), 1073741824::bigint, 'A6 업체 한도 반영');

-- ===== A7 자동 정리 =====
select ok(exists (select 1 from public.admin_cleanup_candidates() where id = 'e0000000-0000-0000-0000-000000000001'), 'A7 거부 파일은 정리 후보');
select is(public.admin_purge_files(array['e0000000-0000-0000-0000-000000000001'::uuid, gen_random_uuid()]), 1, 'A7 후보만 정리');
select is(public.admin_purge_read_notifications(90), 1, 'A7 90일 지난 읽은 알림만 정리');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select throws_ok($$ select public.admin_purge_read_notifications(90) $$, 'P0001', 'forbidden', 'A7 일반 사용자 정리 거부');

-- ===== A8 관리 기록 =====
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select ok((select count(*) >= 6 from public.admin_audit(100, 0)), 'A8 처리마다 기록');
select ok(exists (select 1 from public.admin_audit(100, 0) where action = 'company_owner_changed' and actor_id = 'a0000000-0000-0000-0000-000000000001'),
  'A8 작업한 관리자 기록');

select * from finish();
rollback;

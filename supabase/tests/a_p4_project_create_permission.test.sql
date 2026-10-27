-- a_p4_project_create_permission.test.sql
-- A D-36 프로젝트 생성 권한 · 요청 (20261025000100)
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;
select * from no_plan();

-- ---- 공통 시드 (a/b/c 테스트 파일에 동일하게 복제. 변경 시 3개 파일 모두 갱신) ----
-- 사용자: owner1·pm1·pm2 = 업체1 스태프 / cust1(확정권)·cust2 = P1 고객 / field1 = P1 시공팀
--         out1 = 업체2 소유자 / stranger = 소속 없음
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'owner1@test.local',   '{"display_name":"소유자1"}'),
  ('a0000000-0000-0000-0000-000000000002', 'pm1@test.local',      '{"display_name":"PM1"}'),
  ('a0000000-0000-0000-0000-000000000003', 'pm2@test.local',      '{"display_name":"PM2"}'),
  ('a0000000-0000-0000-0000-000000000004', 'cust1@test.local',    '{"display_name":"고객1"}'),
  ('a0000000-0000-0000-0000-000000000005', 'cust2@test.local',    '{"display_name":"고객2"}'),
  ('a0000000-0000-0000-0000-000000000006', 'field1@test.local',   '{"display_name":"시공1"}'),
  ('a0000000-0000-0000-0000-000000000007', 'out1@test.local',     '{"display_name":"타업체"}'),
  ('a0000000-0000-0000-0000-000000000008', 'stranger@test.local', '{"display_name":"외부인"}');

insert into public.companies (id, slug, name, created_by) values
  ('c0000000-0000-0000-0000-000000000001', 'studio-one', '스튜디오 원', 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000002', 'studio-two', '스튜디오 투', 'a0000000-0000-0000-0000-000000000007');
insert into public.company_settings (company_id) values
  ('c0000000-0000-0000-0000-000000000001'), ('c0000000-0000-0000-0000-000000000002');
insert into public.company_members (company_id, user_id, role) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'pm'),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'pm'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000007', 'owner');

-- P1: 업체1, pm1 생성, 고객 공개 / P2: 업체1, pm2 생성, 비공개 / P3: 업체2
insert into public.projects (id, company_id, name, is_public, created_by) values
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '강남 A현장', true,  'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', '성수 B현장', false, 'a0000000-0000-0000-0000-000000000003'),
  ('b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', '타업체 현장', true, 'a0000000-0000-0000-0000-000000000007');
insert into public.project_participants (project_id, company_id, user_id, role, can_confirm) values
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'customer', true),
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 'customer', false),
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000006', 'field', false);

-- 준비 완료된 파일 (업로더 pm1, P1) / f9 = 업체2 P3 파일
insert into public.files (id, company_id, project_id, kind, path, original_name, mime, size_bytes, status, uploaded_by) values
  ('f0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'design_original', 'test/f1.pdf', 'plan-v1.pdf', 'application/pdf', 1000, 'ready', 'a0000000-0000-0000-0000-000000000002'),
  ('f0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'design_original', 'test/f2.pdf', 'plan-v2.pdf', 'application/pdf', 1000, 'ready', 'a0000000-0000-0000-0000-000000000002'),
  ('f0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'material_image',  'test/f3.jpg', 'tile.jpg', 'image/jpeg', 1000, 'ready', 'a0000000-0000-0000-0000-000000000002'),
  ('f0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'estimate_pdf',    'test/f4.pdf', 'est-v1.pdf', 'application/pdf', 1000, 'ready', 'a0000000-0000-0000-0000-000000000002'),
  ('f0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'estimate_pdf',    'test/f5.pdf', 'est-v2.pdf', 'application/pdf', 1000, 'ready', 'a0000000-0000-0000-0000-000000000002'),
  ('f0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'photo_original',  'test/f6.jpg', 'site.jpg', 'image/jpeg', 1000, 'ready', 'a0000000-0000-0000-0000-000000000006'),
  ('f0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'design_original', 'test/f7.pdf', 'other.pdf', 'application/pdf', 1000, 'ready', 'a0000000-0000-0000-0000-000000000003'),
  ('f0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 'design_original', 'test/f9.pdf', 'p3.pdf', 'application/pdf', 1000, 'ready', 'a0000000-0000-0000-0000-000000000007');
-- ---- 공통 시드 끝 ----

-- 사용자 전환 헬퍼
create function pg_temp.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true)
$$;
set local role authenticated;

-- ===== 0. D-35 담당 프로젝트: 담당자는 배정된 프로젝트만, 업체관리자는 전체 =====
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
select results_eq($$ select name from public.projects order by name $$, $$ values ('성수 B현장'::text) $$,
  'D-35 담당자 pm2 는 자기가 배정된 프로젝트만 본다');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
select results_eq($$ select name from public.projects order by name $$,
  $$ values ('강남 A현장'::text), ('성수 B현장'::text) $$, 'D-35 업체관리자는 업체의 모든 프로젝트를 본다');

-- ===== 1. 기본값: 담당자는 생성 권한 없음, 소유자는 있음 =====
select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
select throws_ok($$insert into public.projects (company_id, name, created_by)
  values ('c0000000-0000-0000-0000-000000000001', '권한 없는 생성', 'a0000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'D-36 권한 없는 담당자는 프로젝트를 만들 수 없다 (RLS)');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
select lives_ok($$insert into public.projects (company_id, name, created_by)
  values ('c0000000-0000-0000-0000-000000000001', '소유자 생성', 'a0000000-0000-0000-0000-000000000001')$$,
  'D-36 업체관리자(소유자)는 언제나 만들 수 있다');

-- ===== 2. 담당자가 직접 권한 칸을 바꿀 수 없음 =====
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
select throws_ok($$update public.company_members set can_create_projects = true
  where user_id = 'a0000000-0000-0000-0000-000000000002'$$, 'P0001', null,
  'D-36 일반 수정으로는 권한 칸을 바꿀 수 없다 (소유자도 RPC 로만)');

-- ===== 3. 요청 → 승인 =====
select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
select set_config('test.req', public.request_project_create('c0000000-0000-0000-0000-000000000001', '새 현장 맡았습니다')::text, true);
select is(public.request_project_create('c0000000-0000-0000-0000-000000000001')::text, current_setting('test.req'),
  'D-36 대기 중 요청이 있으면 같은 요청을 돌려준다 (중복 없음)');
select is((select count(*)::int from public.project_create_requests), 1, '담당자는 자기 요청만 본다');
select throws_ok($$select public.decide_project_create_request(current_setting('test.req')::uuid, true)$$,
  'P0001', 'forbidden', 'D-36 담당자는 승인할 수 없다');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.project_create_requests), 0, '다른 담당자는 남의 요청을 못 본다');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000007');
select throws_ok($$select public.decide_project_create_request(current_setting('test.req')::uuid, true)$$,
  'P0001', 'forbidden', 'D-36 다른 업체 소유자는 승인할 수 없다');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.project_create_requests where status = 'pending'), 1, '업체관리자는 대기 요청을 본다');
select lives_ok($$select public.decide_project_create_request(current_setting('test.req')::uuid, true)$$, '업체관리자 승인');
select is((select status from public.project_create_requests where id = current_setting('test.req')::uuid), 'approved', '요청 상태 승인');
select ok((select can_create_projects from public.company_members where user_id = 'a0000000-0000-0000-0000-000000000002'), '승인하면 권한이 켜진다');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
select lives_ok($$insert into public.projects (company_id, name, created_by)
  values ('c0000000-0000-0000-0000-000000000001', '승인 후 생성', 'a0000000-0000-0000-0000-000000000002')$$,
  'D-36 권한을 받은 담당자는 만들 수 있다');
select throws_ok($$select public.request_project_create('c0000000-0000-0000-0000-000000000001')$$,
  'P0001', 'already_allowed', '이미 권한이 있으면 요청할 필요 없음');

-- ===== 4. 업체관리자가 직접 끄기 / 켜기 =====
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
select lives_ok($$select public.set_project_create_permission(
  (select id from public.company_members where user_id = 'a0000000-0000-0000-0000-000000000002'), false)$$, '권한 끄기');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
select throws_ok($$insert into public.projects (company_id, name, created_by)
  values ('c0000000-0000-0000-0000-000000000001', '회수 후', 'a0000000-0000-0000-0000-000000000002')$$,
  '42501', null, '권한을 끄면 다시 만들 수 없다');
select throws_ok($$select public.set_project_create_permission(
  (select id from public.company_members where user_id = 'a0000000-0000-0000-0000-000000000003'), true)$$,
  'P0001', 'forbidden', '담당자는 남에게 권한을 줄 수 없다');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
select throws_ok($$select public.set_project_create_permission(
  (select id from public.company_members where user_id = 'a0000000-0000-0000-0000-000000000001'), true)$$,
  'P0001', 'invalid_target', '소유자 · 관리자 행에는 권한 칸이 없다');

-- 요청 중 직접 켜면 요청도 승인 처리
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
select set_config('test.req2', public.request_project_create('c0000000-0000-0000-0000-000000000001')::text, true);
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
select lives_ok($$select public.set_project_create_permission(
  (select id from public.company_members where user_id = 'a0000000-0000-0000-0000-000000000003'), true)$$, '직접 켜기');
select is((select status from public.project_create_requests where id = current_setting('test.req2')::uuid), 'approved', '대기 요청도 함께 승인');

-- 거절: 권한 끄고 다시 요청 → 거절
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
select lives_ok($$select public.set_project_create_permission(
  (select id from public.company_members where user_id = 'a0000000-0000-0000-0000-000000000003'), false)$$, '다시 끄기');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
select set_config('test.req3', public.request_project_create('c0000000-0000-0000-0000-000000000001')::text, true);
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
select lives_ok($$select public.decide_project_create_request(current_setting('test.req3')::uuid, false)$$, '거절');
select ok(not (select can_create_projects from public.company_members where user_id = 'a0000000-0000-0000-0000-000000000003'), '거절하면 권한 없음 유지');
select throws_ok($$select public.decide_project_create_request(current_setting('test.req3')::uuid, true)$$,
  'P0001', 'forbidden', '이미 처리된 요청은 다시 처리할 수 없다');

-- ===== 5. 쓰기는 RPC 전용 =====
select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
select throws_ok($$insert into public.project_create_requests (company_id, user_id)
  values ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002')$$,
  '42501', null, '요청 테이블 직접 쓰기 금지');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000004');
select throws_ok($$select public.request_project_create('c0000000-0000-0000-0000-000000000001')$$,
  'P0001', 'forbidden', '고객은 요청할 수 없다');

select * from finish();
rollback;

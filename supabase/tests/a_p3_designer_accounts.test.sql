-- a_p3_designer_accounts.test.sql
-- A 디자이너 페이지 2단계 (20261024000100) — 업체 승인 대기·정지 / 첫 로그인 비밀번호 표시 / 고객·시공팀 계정 배정
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

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000009', 'newowner@test.local', '{"display_name":"새 디자이너"}'),
  ('a0000000-0000-0000-0000-00000000000a', 'newcust@test.local',  '{"display_name":"새 고객"}');

-- ===== 1. 기존 업체는 승인 상태로 유지 =====
select is((select status from public.companies where id = 'c0000000-0000-0000-0000-000000000001'), 'approved',
  'D-11 기존 업체는 approved 로 채워짐');

-- ===== 2. 셀프 가입 업체는 대기 → 승인 전에는 아무 권한 없음 =====
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select set_config('test.newco', public.create_company_with_owner(
  'a0000000-0000-0000-0000-000000000009', '새 스튜디오', 'new-studio', '새 디자이너')::text, true);
select is((select status from public.companies where id = current_setting('test.newco')::uuid), 'pending',
  'D-10 셀프 가입 업체는 pending');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000009","role":"authenticated"}', true);
select ok(not private.is_company_staff(current_setting('test.newco')::uuid), 'D-11 대기 업체 소유자는 구성원 권한 없음');
select is((select count(*)::int from public.companies where id = current_setting('test.newco')::uuid), 0,
  'D-11 대기 업체 소유자는 업체 행을 읽지 못함 (RLS)');
select is((select status from public.my_inactive_companies() where id = current_setting('test.newco')::uuid), 'pending',
  'D-11 my_inactive_companies 로 내 대기 업체를 안내할 수 있음');
select throws_ok($$ select public.set_company_status(current_setting('test.newco')::uuid, 'approved') $$,
  '42501', NULL, 'D-11 일반 사용자는 업체 상태를 바꿀 수 없음');

-- 다른 사용자는 남의 대기 업체를 my_inactive_companies 로 보지 못함
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from public.my_inactive_companies()), 0, 'D-11 남의 대기 업체는 보이지 않음');

-- 사이트 관리자(service_role) 승인 → 권한 생김
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok($$ select public.set_company_status(current_setting('test.newco')::uuid, 'approved') $$,
  'D-11 service_role 은 승인 가능');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000009","role":"authenticated"}', true);
select ok(private.is_company_staff(current_setting('test.newco')::uuid), 'D-11 승인 후 소유자 권한 생김');
select throws_ok($$ update public.companies set status = 'suspended' where id = current_setting('test.newco')::uuid $$,
  'P0001', 'system_column:status', 'D-11 소유자도 상태 컬럼은 직접 못 바꿈');

-- ===== 3. 정지된 업체는 고객·시공팀 배정도 무효 =====
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select ok(private.can_view_as_customer('b0000000-0000-0000-0000-000000000001'), 'D-11 승인 업체 고객은 열람 가능');
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.set_company_status('c0000000-0000-0000-0000-000000000001', 'suspended');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select ok(not private.can_view_as_customer('b0000000-0000-0000-0000-000000000001'), 'D-11 정지 업체 고객은 열람 불가');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select ok(not private.can_edit_project('b0000000-0000-0000-0000-000000000001'), 'D-11 정지 업체 디자이너는 편집 불가');
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.set_company_status('c0000000-0000-0000-0000-000000000001', 'approved');

-- ===== 4. 첫 로그인 비밀번호 표시는 시스템만 바꿈 =====
select lives_ok($$ update public.profiles set must_change_password = true, temp_password_expires_at = now() + interval '72 hours'
  where id = 'a0000000-0000-0000-0000-00000000000a' $$, 'D-15 service_role 은 변경 필요 표시 가능');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ update public.profiles set must_change_password = false where id = 'a0000000-0000-0000-0000-00000000000a' $$,
  'P0001', 'system_column:must_change_password', 'D-15 본인도 표시를 직접 지우지 못함');
select lives_ok($$ update public.profiles set locale = 'en' where id = 'a0000000-0000-0000-0000-00000000000a' $$,
  'D-15 다른 프로필 항목(언어)은 그대로 바꿀 수 있음');

-- ===== 5. 고객·시공팀 계정 배정 RPC =====
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select set_config('test.part', public.assign_external_participant(
  'b0000000-0000-0000-0000-000000000001', 'NewCust@test.local', 'customer', true, null, null)::text, true);
select is((select role::text || ':' || can_confirm::text from public.project_participants where id = current_setting('test.part')::uuid),
  'customer:true', 'D-12 편집자가 이메일로 고객 배정 (대소문자 무시, 확정권)');
select is(public.assign_external_participant('b0000000-0000-0000-0000-000000000001', 'newcust@test.local', 'field', true, null, null) is not null,
  true, 'D-12 같은 사람을 시공팀으로도 배정 가능');
select is((select can_confirm from public.project_participants
  where user_id = 'a0000000-0000-0000-0000-00000000000a' and role = 'field'), false, 'D-12 시공팀은 확정권 없음');

-- 회수 후 다시 배정하면 같은 행이 다시 유효
update public.project_participants set revoked_at = now() where id = current_setting('test.part')::uuid;
select is(public.assign_external_participant('b0000000-0000-0000-0000-000000000001', 'newcust@test.local', 'customer', false, '2026-01-01', '2026-12-31'),
  current_setting('test.part')::uuid, 'D-12 회수된 배정은 같은 행으로 다시 유효화');
select is((select revoked_at is null and not can_confirm and valid_until = '2026-12-31'::date from public.project_participants
  where id = current_setting('test.part')::uuid), true, 'D-12 재배정 시 기간·확정권 갱신');

select throws_ok($$ select public.assign_external_participant('b0000000-0000-0000-0000-000000000001', 'nobody@test.local', 'customer', false, null, null) $$,
  'P0001', 'user_not_found', 'D-12 없는 이메일은 user_not_found');
select throws_ok($$ select public.assign_external_participant('b0000000-0000-0000-0000-000000000001', 'pm2@test.local', 'customer', false, null, null) $$,
  'P0001', 'scope_mismatch', 'D-12 같은 업체 디자이너는 고객으로 배정 불가');
select throws_ok($$ select public.assign_external_participant('b0000000-0000-0000-0000-000000000001', 'newcust@test.local', 'pm', false, null, null) $$,
  'P0001', 'invalid_target', 'D-12 pm 역할은 이 RPC 로 배정 불가');

-- 권한 거부: 고객·다른 업체·외부인
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select throws_ok($$ select public.assign_external_participant('b0000000-0000-0000-0000-000000000001', 'stranger@test.local', 'customer', false, null, null) $$,
  'P0001', 'forbidden', 'D-12 고객은 배정 불가');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
select throws_ok($$ select public.assign_external_participant('b0000000-0000-0000-0000-000000000001', 'stranger@test.local', 'customer', false, null, null) $$,
  'P0001', 'forbidden', 'D-12 다른 업체 소유자는 배정 불가');
set local role anon;
select throws_ok($$ select public.assign_external_participant('b0000000-0000-0000-0000-000000000001', 'stranger@test.local', 'customer', false, null, null) $$,
  '42501', NULL, 'D-12 비로그인은 실행 권한 없음');

select * from finish();
rollback;

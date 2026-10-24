-- a_p2_security_scope.test.sql
-- A(박예원) 파트 2 신규 마이그레이션 검증 — SEC-01, DB-04~09 (20261013000100~150)
-- 실행: _integration/tools/run-pgtap.mjs (Supabase CLI test db 와 같은 형식). 트랜잭션 안에서 실행 후 롤백.
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

-- 추가 시드: out1(업체2 owner)을 P1 고객으로 참여 / cust3 = 회수된 P1 참여자 / pm2 가 P1 에 올린 pending 파일
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000009', 'cust3@test.local', '{"display_name":"고객3"}');
insert into public.project_participants (project_id, company_id, user_id, role, can_confirm, revoked_at) values
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000007', 'customer', false, null),
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000009', 'customer', false, now());
insert into public.files (id, company_id, project_id, kind, path, original_name, mime, size_bytes, status, uploaded_by) values
  ('f0000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'design_original', 'test/pending.pdf', 'pending.pdf', 'application/pdf', 1000, 'pending', 'a0000000-0000-0000-0000-000000000003');

-- ===== SEC-01 재설정 링크 대상 범위 (service_role 전용 RPC — 테스트는 postgres 로 직접 호출) =====
select ok(not public.can_issue_password_reset('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000007'),
  'SEC-01 업체1 owner 는 P1 고객으로 참여한 업체2 owner 의 재설정 링크를 만들 수 없다');
select ok(public.can_issue_password_reset('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002'),
  'SEC-01 업체1 owner 는 업체1 pm1 의 링크를 만들 수 있다');
select ok(public.can_issue_password_reset('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004'),
  'SEC-01 업체1 에만 참여한 고객 cust1 은 대상이 된다');
select ok(not public.can_issue_password_reset('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000009'),
  'SEC-01 회수된 참여자 cust3 은 대상이 아니다');
select ok(not public.can_issue_password_reset('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),
  'SEC-01 자기 자신은 대상이 아니다');
select ok(not public.can_issue_password_reset('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004'),
  'SEC-01 pm 은 링크를 만들 수 없다');
select ok(not has_function_privilege('authenticated', 'public.can_issue_password_reset(uuid, uuid, uuid)', 'EXECUTE'),
  'SEC-01 authenticated 는 RPC 를 직접 실행할 수 없다');

-- ===== DB-05 시공팀 프로젝트 열람 축소 =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
select is((select count(*)::int from public.projects), 0, 'DB-05 시공팀 field1 은 projects 행을 직접 조회할 수 없다');
select results_eq($$ select name from public.field_projects() $$, $$ values ('강남 A현장'::text) $$, 'DB-05 field_projects() 는 배정 현장만 준다');
select is((select count(*)::int from public.project_brief('b0000000-0000-0000-0000-000000000001')), 1, 'DB-05 시공팀도 배정 현장의 project_brief 는 받는다');
select is((select count(*)::int from public.project_brief('b0000000-0000-0000-0000-000000000002')), 0, 'DB-05 배정되지 않은 P2 의 project_brief 는 0행');
select lives_ok($$ insert into public.files (company_id, project_id, kind, path, original_name, mime, size_bytes, uploaded_by)
  values ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'photo_original', 'test/field-new.jpg', 'new.jpg', 'image/jpeg', 10, 'a0000000-0000-0000-0000-000000000006') $$,
  'DB-05 시공팀 사진 업로드 의도 등록은 계속 된다 (files_insert 서브쿼리 교체)');
select throws_ok($$ insert into public.files (company_id, project_id, kind, path, original_name, mime, size_bytes, uploaded_by)
  values ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'photo_original', 'test/field-bad.jpg', 'bad.jpg', 'image/jpeg', 10, 'a0000000-0000-0000-0000-000000000006') $$,
  '42501', NULL, 'DB-05 프로젝트와 다른 company_id 로는 등록할 수 없다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select is((select count(*)::int from public.projects), 1, 'DB-05 고객 cust1 은 공개 P1 을 계속 조회한다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000008","role":"authenticated"}', true);
select is((select count(*)::int from public.project_brief('b0000000-0000-0000-0000-000000000001')), 0, 'DB-05 외부인은 project_brief 0행');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from public.projects), 1, 'DB-05 pm1 은 배정 P1 을 계속 조회한다');

-- ===== DB-07 준비 전 파일은 업로더 본인만 =====
select is_empty($$ select 1 from public.files where id = 'f0000000-0000-0000-0000-0000000000a1' $$, 'DB-07 편집자 pm1 도 남이 올린 pending 파일 행은 볼 수 없다');
select isnt_empty($$ select 1 from public.files where id = 'f0000000-0000-0000-0000-000000000001' $$, 'DB-07 ready 파일은 계속 보인다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select isnt_empty($$ select 1 from public.files where id = 'f0000000-0000-0000-0000-0000000000a1' $$, 'DB-07 업로더 pm2 는 자기 pending 파일을 본다');
reset role;

-- ===== DB-09 파일 상태 되돌림 금지 =====
select throws_ok($$ update public.files set status = 'pending' where id = 'f0000000-0000-0000-0000-000000000001' $$,
  'P0001', 'immutable_column:status', 'DB-09 ready 파일을 pending 으로 되돌릴 수 없다');
select lives_ok($$ update public.files set status = 'ready' where id = 'f0000000-0000-0000-0000-0000000000a1' $$, 'DB-09 pending → ready 는 허용');

-- ===== DB-06 회수 시 당사자 알림 (시드 배정 때 생긴 알림 1건과 구분하려고 증가분을 본다) =====
select set_config('test.n_before', (select count(*)::text from public.notifications
  where recipient_id = 'a0000000-0000-0000-0000-000000000006' and type = 'assignment_changed'), true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
update public.project_participants set revoked_at = now()
  where project_id = 'b0000000-0000-0000-0000-000000000001' and user_id = 'a0000000-0000-0000-0000-000000000006';
reset role;
select is((select count(*)::int from public.notifications where recipient_id = 'a0000000-0000-0000-0000-000000000006' and type = 'assignment_changed')
          - current_setting('test.n_before')::int, 1,
  'DB-06 회수된 시공팀 field1 에게 assignment_changed 알림이 간다 (회수 전에는 수신자 필터 때문에 0건이었음)');

-- ===== DB-04 clients.created_by 트리거 / DB-08 고객 카드 연결 보관·변경 =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok($$ insert into public.clients (id, company_id, name) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '고객카드1'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', '고객카드2') $$,
  'DB-04 created_by 를 보내지 않아도 고객 카드가 만들어진다');
select is((select created_by from public.clients where id = 'd0000000-0000-0000-0000-000000000001'), 'a0000000-0000-0000-0000-000000000002'::uuid, 'DB-04 created_by = 호출자');
select lives_ok($$ insert into public.client_projects (id, client_id, project_id, company_id) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001') $$, 'DB-08 연결');
select throws_ok($$ insert into public.client_projects (client_id, project_id, company_id) values
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001') $$,
  '23505', NULL, 'DB-08 유효 연결이 있으면 다른 카드에 연결할 수 없다');
select lives_ok($$ update public.client_projects set archived_at = now() where id = 'e0000000-0000-0000-0000-000000000001' $$, 'DB-08 연결 보관(해제)');
select is((select count(*)::int from public.client_projects where id = 'e0000000-0000-0000-0000-000000000001' and archived_at is not null), 1, 'DB-08 보관이 실제로 반영된다');
select lives_ok($$ insert into public.client_projects (client_id, project_id, company_id) values
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001') $$, 'DB-08 해제 후 다른 카드에 연결');
select throws_ok($$ update public.client_projects set client_id = 'd0000000-0000-0000-0000-000000000002' where id = 'e0000000-0000-0000-0000-000000000001' $$,
  'P0001', NULL, 'DB-08 연결 대상(client_id)은 바꿀 수 없다 (보관 후 새로 연결)');
reset role;

select * from finish();
rollback;

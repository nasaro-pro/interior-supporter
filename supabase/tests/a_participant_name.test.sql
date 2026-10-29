-- a_participant_name.test.sql
-- A 참여자 이름 수정 (20261029000100_a_participant_name.sql) — 디자이너가 고객 · 시공팀 이름을 고친다
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;
select * from no_plan();

-- ---- 시드: owner1 · pm1(P1 담당) · pm2(배정 없음) = 업체1 / cust1 · field1 · cust2(회수) = P1 / out1 = 업체2 ----
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'owner1@test.local', '{"display_name":"소유자1"}'),
  ('a0000000-0000-0000-0000-000000000002', 'pm1@test.local',    '{"display_name":"PM1"}'),
  ('a0000000-0000-0000-0000-000000000003', 'pm2@test.local',    '{"display_name":"PM2"}'),
  ('a0000000-0000-0000-0000-000000000004', 'cust1@test.local',  '{"display_name":"고객1"}'),
  ('a0000000-0000-0000-0000-000000000005', 'field1@test.local', '{"display_name":"시공1"}'),
  ('a0000000-0000-0000-0000-000000000006', 'cust2@test.local',  '{"display_name":"고객2"}'),
  ('a0000000-0000-0000-0000-000000000007', 'out1@test.local',   '{"display_name":"타업체"}');
insert into public.companies (id, slug, name, created_by) values
  ('c0000000-0000-0000-0000-000000000001', 'studio-one', '스튜디오 원', 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000002', 'studio-two', '스튜디오 투', 'a0000000-0000-0000-0000-000000000007');
insert into public.company_members (company_id, user_id, role) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'pm'),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'pm'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000007', 'owner');
insert into public.projects (id, company_id, name, is_public, created_by) values
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '현장', true, 'a0000000-0000-0000-0000-000000000001');
insert into public.project_participants (id, project_id, company_id, user_id, role, can_confirm, revoked_at) values
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'pm', false, null),
  ('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'customer', true, null),
  ('d0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 'field', false, null),
  ('d0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000006', 'customer', false, now());

set local role authenticated;

-- ===== 정상: 담당 디자이너가 고객 · 시공팀 이름을 고친다 =====
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok($$ select public.update_participant_name('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', '  김고객  ') $$,
  '담당 디자이너: 고객 이름 수정');
select lives_ok($$ select public.update_participant_name('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005', '이반장') $$,
  '담당 디자이너: 시공팀 이름 수정');

-- ===== 예외 =====
select throws_ok($$ select public.update_participant_name('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', '   ') $$,
  'P0001', 'reason_required', '빈 이름은 거부');
select throws_ok($$ select public.update_participant_name('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', repeat('가', 81)) $$,
  'P0001', 'reason_required', '80자 초과는 거부');
select throws_ok($$ select public.update_participant_name('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006', '회수됨') $$,
  'P0001', 'invalid_target', '회수된 참여는 고치지 않는다');
select throws_ok($$ select public.update_participant_name('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', '다른 이름') $$,
  'P0001', 'invalid_target', 'PM(업체 구성원) 참여는 고치지 않는다');
select throws_ok($$ select public.update_participant_name('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', '없음') $$,
  'P0001', 'project_not_found', '없는 참여');

-- ===== 권한 거부 =====
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select throws_ok($$ select public.update_participant_name('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', '해킹') $$,
  'P0001', 'forbidden', '배정되지 않은 디자이너는 거부');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
select throws_ok($$ select public.update_participant_name('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', '해킹') $$,
  'P0001', 'forbidden', '다른 업체는 거부');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select throws_ok($$ select public.update_participant_name('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005', '해킹') $$,
  'P0001', 'forbidden', '고객은 다른 참여자 이름을 못 바꾼다');
-- 프로필 직접 수정은 여전히 본인 행만 (RLS → 0행)
update public.profiles set display_name = '직접수정' where id = 'a0000000-0000-0000-0000-000000000005';

reset role;
select is((select display_name from public.profiles where id = 'a0000000-0000-0000-0000-000000000004'), '김고객', '고객 이름 반영 (앞뒤 공백 제거)');
select is((select display_name from public.profiles where id = 'a0000000-0000-0000-0000-000000000005'), '이반장', '시공팀 이름 반영, 남의 직접 수정은 막힘');
select is((select display_name from public.profiles where id = 'a0000000-0000-0000-0000-000000000006'), '고객2', '회수된 참여자 이름 그대로');
select is((select display_name from public.profiles where id = 'a0000000-0000-0000-0000-000000000002'), 'PM1', 'PM 이름 그대로');

-- 업체 소유자도 (편집 권한) 고칠 수 있다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($$ select public.update_participant_name('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', '김고객님') $$,
  '업체 소유자: 고객 이름 수정');

select * from finish();
rollback;

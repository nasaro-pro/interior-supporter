-- a_admin_grant.test.sql
-- 사이트 관리자 권한 부여·해제 (20261118000100_a_admin_grant.sql)
-- 실행: npm run db:test (Supabase CLI test db). 트랜잭션 안에서 실행 후 롤백.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;
select * from no_plan();

-- admin1 = 사이트 관리자 / user2 = 일반 / user3 = 정지된 계정
insert into auth.users (id, email, raw_user_meta_data) values
  ('a1000000-0000-0000-0000-000000000001', 'admin1@grant.local', '{"display_name":"관리자"}'),
  ('a1000000-0000-0000-0000-000000000002', 'user2@grant.local',  '{"display_name":"일반"}'),
  ('a1000000-0000-0000-0000-000000000003', 'user3@grant.local',  '{"display_name":"정지"}');
insert into public.platform_admins (user_id) values ('a1000000-0000-0000-0000-000000000001');
select set_config('app.system_write', 'on', true);
update public.profiles set suspended_at = now() where id = 'a1000000-0000-0000-0000-000000000003';
select set_config('app.system_write', 'off', true);

set local role authenticated;

-- 관리자가 아니면 거부
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$ select public.admin_set_platform_admin('a1000000-0000-0000-0000-000000000002', true) $$,
  'P0001', 'forbidden', '관리자 아닌 계정은 부여 불가 (본인 포함)');

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
-- 본인 대상 거부 → 관리자가 0명이 될 수 없다
select throws_ok($$ select public.admin_set_platform_admin('a1000000-0000-0000-0000-000000000001', false) $$,
  'P0001', 'self_target', '본인 해제 거부');
-- 정지 계정에는 부여 안 함
select throws_ok($$ select public.admin_set_platform_admin('a1000000-0000-0000-0000-000000000003', true) $$,
  'P0001', 'inactive_target', '정지 계정 부여 거부');
-- 없는 계정
select throws_ok($$ select public.admin_set_platform_admin('a1000000-0000-0000-0000-0000000000ff', true) $$,
  'P0001', 'not_found', '없는 계정');

-- 부여 → 목록에 관리자 표시 + 기록
select lives_ok($$ select public.admin_set_platform_admin('a1000000-0000-0000-0000-000000000002', true) $$, '부여');
select ok((select is_admin from public.admin_users('user2@grant')), '부여 후 관리자 표시');
select lives_ok($$ select public.admin_set_platform_admin('a1000000-0000-0000-0000-000000000002', true) $$, '이미 관리자에게 다시 부여해도 오류 없음');
select is((select count(*)::int from public.admin_audit(100, 0) where action = 'admin_granted'
            and target_id = 'a1000000-0000-0000-0000-000000000002'), 1, '부여 기록 1건 (중복 부여는 기록 안 함)');

-- 새 관리자는 관리자 RPC 를 쓸 수 있다
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select ok(public.is_platform_admin(), '새 관리자 판별');
select lives_ok($$ select * from public.admin_dashboard() $$, '새 관리자로 관리 대시보드 조회');

-- 해제
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($$ select public.admin_set_platform_admin('a1000000-0000-0000-0000-000000000002', false) $$, '해제');
select ok(not (select is_admin from public.admin_users('user2@grant')), '해제 후 관리자 아님');
select ok(exists (select 1 from public.admin_audit(100, 0) where action = 'admin_revoked'
               and target_id = 'a1000000-0000-0000-0000-000000000002'), '해제 기록');
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select ok(not public.is_platform_admin(), '해제된 계정은 관리자 아님');

-- 표에 직접 쓰기는 여전히 막힘
select throws_ok($$ insert into public.platform_admins (user_id) values ('a1000000-0000-0000-0000-000000000002') $$,
  '42501', null, '앱 계정이 표에 직접 추가 불가');

select * from finish();
rollback;

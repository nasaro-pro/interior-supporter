-- a_customer_preview.test.sql
-- A 고객 화면 미리보기 (20261029000200_a_customer_preview.sql)
-- 헤더 x-customer-preview + 읽기 전용 트랜잭션 + 진짜 편집자일 때만 고객 규칙으로 본다
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;
select * from no_plan();

-- ---- 시드: owner1 · pm1(P1 담당) · pm2(배정 없음) = 업체1 / cust1 = P1 고객 / P2 = 같은 업체 다른 현장 ----
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'owner1@test.local', '{"display_name":"소유자1"}'),
  ('a0000000-0000-0000-0000-000000000002', 'pm1@test.local',    '{"display_name":"PM1"}'),
  ('a0000000-0000-0000-0000-000000000003', 'pm2@test.local',    '{"display_name":"PM2"}'),
  ('a0000000-0000-0000-0000-000000000004', 'cust1@test.local',  '{"display_name":"고객1"}');
insert into public.companies (id, slug, name, created_by) values
  ('c0000000-0000-0000-0000-000000000001', 'studio-one', '스튜디오 원', 'a0000000-0000-0000-0000-000000000001');
insert into public.company_members (company_id, user_id, role) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'pm'),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'pm');
-- P1 은 고객 공개 꺼짐 (공개 전 점검), P2 는 공개
insert into public.projects (id, company_id, name, is_public, created_by) values
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '현장1', false, 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', '현장2', true, 'a0000000-0000-0000-0000-000000000001');
insert into public.project_participants (project_id, company_id, user_id, role, can_confirm) values
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'pm', false),
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'customer', false);
-- created_by 는 트리거가 요청자(auth.uid())로 채운다
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
insert into public.schedule_events (id, company_id, project_id, title, start_date, created_by, is_public) values
  ('e1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '공개 일정', current_date, 'a0000000-0000-0000-0000-000000000001', true),
  ('e1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '비공개 일정', current_date, 'a0000000-0000-0000-0000-000000000001', false),
  ('e1000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'P2 비공개', current_date, 'a0000000-0000-0000-0000-000000000001', false);
insert into public.designs (id, company_id, project_id, title, is_public, confirm_state, current_version, created_by) values
  ('d2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '공개 도안', true, 'none', 0, 'a0000000-0000-0000-0000-000000000001'),
  ('d2000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '비공개 도안', false, 'none', 0, 'a0000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

-- ===== 헤더 없음: 평소처럼 편집자 =====
select is((select count(*)::int from public.schedule_events where project_id = 'b0000000-0000-0000-0000-000000000001'), 2,
  '헤더 없음: 담당자는 비공개 일정까지 2건');

-- ===== 헤더 있음 + 쓰기 가능 트랜잭션: 무시 (쓰기 요청에서는 미리보기 아님) =====
select set_config('request.headers', '{"x-customer-preview":"b0000000-0000-0000-0000-000000000001"}', true);
select ok(private.preview_project() is null, '쓰기 가능 트랜잭션에서는 미리보기가 꺼져 있다');
select is((select count(*)::int from public.schedule_events where project_id = 'b0000000-0000-0000-0000-000000000001'), 2,
  '쓰기 가능 트랜잭션: 편집자 그대로');

-- ===== 이후 읽기 전용 (PostgREST GET 과 같음) =====
set transaction_read_only = on;

-- 담당자 pm1 + 헤더(P1): 고객 규칙
select is(private.preview_project(), 'b0000000-0000-0000-0000-000000000001'::uuid, '읽기 전용 + 진짜 편집자: 미리보기 켜짐');
select ok(not private.can_edit_project('b0000000-0000-0000-0000-000000000001'), '미리보기 프로젝트에서는 편집자가 아니다');
select ok(private.can_view_as_customer('b0000000-0000-0000-0000-000000000001'), '고객 공개가 꺼져 있어도 미리보기는 고객 규칙으로 본다');
select is((select array_agg(title order by title) from public.schedule_events where project_id = 'b0000000-0000-0000-0000-000000000001'),
  array['공개 일정'], '일정: 공개분만');
select is((select array_agg(title order by title) from public.designs where project_id = 'b0000000-0000-0000-0000-000000000001'),
  array['공개 도안'], '도안: 공개분만');

-- 같은 요청에서 다른 프로젝트는 영향 없음
select ok(private.can_edit_project('b0000000-0000-0000-0000-000000000002') = private.can_edit_project_for('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002'),
  '다른 프로젝트의 편집 판정은 그대로');

-- 잘못된 헤더 값은 무시
select set_config('request.headers', '{"x-customer-preview":"not-a-uuid"}', true);
select ok(private.preview_project() is null, '잘못된 값: 무시');
select is((select count(*)::int from public.schedule_events where project_id = 'b0000000-0000-0000-0000-000000000001'), 2,
  '잘못된 값: 편집자 그대로');

-- ===== 권한 없는 사람이 헤더를 붙여도 아무것도 열리지 않는다 =====
select set_config('request.headers', '{"x-customer-preview":"b0000000-0000-0000-0000-000000000001"}', true);
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select ok(private.preview_project() is null, '배정되지 않은 담당자: 미리보기 불가');
select is((select count(*)::int from public.schedule_events where project_id = 'b0000000-0000-0000-0000-000000000001'), 0,
  '배정되지 않은 담당자: 헤더로도 일정 0건');

-- 실제 고객: 헤더가 있어도 평소와 같다 (P1 은 비공개 프로젝트라 0건)
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select ok(private.preview_project() is null, '고객: 미리보기 불가');
select is((select count(*)::int from public.schedule_events where project_id = 'b0000000-0000-0000-0000-000000000001'), 0,
  '고객: 비공개 프로젝트는 헤더로도 0건');

-- 소유자도 미리보기 가능
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*)::int from public.schedule_events where project_id = 'b0000000-0000-0000-0000-000000000001'), 1,
  '업체 소유자 미리보기: 공개 일정 1건');

select * from finish();
rollback;

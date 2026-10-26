-- b_p3_design_space.test.sql
-- B 디자이너 페이지 D-26~D-28 (20261024000300) — 도안 공간·대표·순서
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

insert into public.files (id, company_id, project_id, kind, path, original_name, mime, size_bytes, status, uploaded_by) values
  ('f0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'design_original', 'test/f11.pdf', 'kitchen.pdf', 'application/pdf', 1000, 'ready', 'a0000000-0000-0000-0000-000000000002');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select set_config('test.d1', public.create_design('b0000000-0000-0000-0000-000000000001', '전체 평면', '', 'f0000000-0000-0000-0000-000000000001', '', true)::text, true);
select set_config('test.d2', public.create_design('b0000000-0000-0000-0000-000000000001', '거실', '', 'f0000000-0000-0000-0000-000000000002', '', true)::text, true);
select set_config('test.d3', public.create_design('b0000000-0000-0000-0000-000000000001', '주방', '', 'f0000000-0000-0000-0000-000000000011', '', true)::text, true);

-- D-26 공간 지정 (편집자 update), 기본값 null = 전체
select is((select space::text from public.designs where id = current_setting('test.d1')::uuid), null, 'D-26 기본 공간은 null(전체)');
select lives_ok($$ update public.designs set space = 'living' where id = current_setting('test.d2')::uuid $$, 'D-26 편집자는 공간 지정 가능');
select lives_ok($$ update public.designs set space = 'kitchen' where id = current_setting('test.d3')::uuid $$, 'D-26 주방 지정');
select is((select confirm_state::text from public.designs where id = current_setting('test.d2')::uuid), 'none', 'D-26 공간 변경은 확정 상태를 바꾸지 않음');

-- D-27 대표 지정 — 프로젝트당 1개
select lives_ok($$ select public.set_main_design(current_setting('test.d1')::uuid) $$, 'D-27 대표 지정');
select lives_ok($$ select public.set_main_design(current_setting('test.d2')::uuid) $$, 'D-27 다른 도안을 대표로 바꾸기');
select is((select count(*)::int from public.designs where project_id = 'b0000000-0000-0000-0000-000000000001' and is_main), 1, 'D-27 대표는 1개');
select is((select id from public.designs where project_id = 'b0000000-0000-0000-0000-000000000001' and is_main), current_setting('test.d2')::uuid, 'D-27 마지막에 지정한 도안이 대표');
select throws_ok($$ update public.designs set is_main = true where id = current_setting('test.d3')::uuid $$, '23505', NULL,
  'D-27 직접 두 번째 대표를 만들 수 없음 (부분 unique)');

-- 보관하면 대표 해제
select lives_ok($$ update public.designs set archived_at = now() where id = current_setting('test.d2')::uuid $$, '대표 도안 보관');
select is((select is_main from public.designs where id = current_setting('test.d2')::uuid), false, 'D-27 보관하면 대표 표시 해제');
select lives_ok($$ select public.set_main_design(current_setting('test.d3')::uuid) $$, 'D-27 보관 후 새 대표 지정 가능');
select throws_ok($$ select public.set_main_design(current_setting('test.d2')::uuid) $$, 'P0001', 'forbidden', 'D-27 보관된 도안은 대표 불가');

-- D-28 순서
select lives_ok($$ select public.reorder_designs('b0000000-0000-0000-0000-000000000001',
  array[current_setting('test.d3')::uuid, current_setting('test.d1')::uuid]) $$, 'D-28 순서 저장');
select is((select array_agg(id order by sort_order) from public.designs where id in (current_setting('test.d1')::uuid, current_setting('test.d3')::uuid)),
  array[current_setting('test.d3')::uuid, current_setting('test.d1')::uuid], 'D-28 받은 순서대로 sort_order');

-- 권한 거부: 고객·다른 업체
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select throws_ok($$ select public.set_main_design(current_setting('test.d1')::uuid) $$, 'P0001', 'forbidden', 'D-27 고객은 대표 지정 불가');
select throws_ok($$ select public.reorder_designs('b0000000-0000-0000-0000-000000000001', array[current_setting('test.d1')::uuid]) $$,
  'P0001', 'forbidden', 'D-28 고객은 순서 변경 불가');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
select throws_ok($$ select public.reorder_designs('b0000000-0000-0000-0000-000000000001', array[current_setting('test.d1')::uuid]) $$,
  'P0001', 'forbidden', 'D-28 다른 업체는 순서 변경 불가');
-- 다른 프로젝트 id 를 섞어도 이 프로젝트 도안만 바뀐다
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
select set_config('test.p3d', public.create_design('b0000000-0000-0000-0000-000000000003', '타업체', '', 'f0000000-0000-0000-0000-000000000009', '', false)::text, true);
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok($$ select public.reorder_designs('b0000000-0000-0000-0000-000000000001',
  array[current_setting('test.p3d')::uuid, current_setting('test.d1')::uuid]) $$, 'D-28 남의 id 가 섞여도 오류 없음');
set local role postgres;
select is((select sort_order from public.designs where id = current_setting('test.p3d')::uuid), 0, 'D-28 다른 프로젝트 도안은 바뀌지 않음');

select * from finish();
rollback;

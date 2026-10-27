-- c_p4_request_target.test.sql
-- C D-32 · D-33 도안 · 자재 메모 연결 (20261025000300)
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

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
-- 도안 d1(공개) · d2(비공개) / 자재 m1(공개) · m2(보관) — P1 / d9 = P2 도안(공개)
insert into public.designs (id, company_id, project_id, title, is_public, created_by) values
  ('d1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '거실 도안', true,  'a0000000-0000-0000-0000-000000000002'),
  ('d1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '비공개 도안', false, 'a0000000-0000-0000-0000-000000000002'),
  ('d1000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', '다른 현장 도안', true, 'a0000000-0000-0000-0000-000000000003');
insert into public.materials (id, company_id, project_id, name, is_public, created_by) values
  ('d2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '거실 타일', true, 'a0000000-0000-0000-0000-000000000002'),
  ('d2000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '보관 자재', true, 'a0000000-0000-0000-0000-000000000002');
select set_config('app.system_write', 'on', true);
update public.materials set archived_at = now() where id = 'd2000000-0000-0000-0000-000000000002';
select set_config('app.system_write', 'off', true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);

-- 정상: 공개 도안 · 공개 자재에 메모
select lives_ok($$ insert into public.requests (id, project_id, company_id, author_id, title, body, target_type, target_id)
  values ('a2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', '타일 색', '타일 색이 더 밝았으면 해요', 'designs', 'd1000000-0000-0000-0000-000000000001') $$,
  'D-32 고객은 공개 도안에 메모를 단다');
select lives_ok($$ insert into public.requests (id, project_id, company_id, author_id, title, body, target_type, target_id)
  values ('a2000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', '자재', '이 타일 재고 있나요', 'materials', 'd2000000-0000-0000-0000-000000000001') $$,
  'D-32 고객은 공개 자재에 메모를 단다');
select lives_ok($$ insert into public.requests (id, project_id, company_id, author_id, title, body)
  values ('a2000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', '일반', '연결 없는 메모') $$,
  'D-33 연결 항목 없는 메모(대화 탭)도 그대로');

-- 예외: 비공개 · 보관 · 다른 프로젝트 · 없는 항목 · 짝 안 맞음
select throws_ok($$ insert into public.requests (project_id, company_id, author_id, title, body, target_type, target_id)
  values ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'x', 'x', 'designs', 'd1000000-0000-0000-0000-000000000002') $$,
  'P0001', 'invalid_target', 'D-32 비공개 도안에는 메모를 달 수 없다');
select throws_ok($$ insert into public.requests (project_id, company_id, author_id, title, body, target_type, target_id)
  values ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'x', 'x', 'materials', 'd2000000-0000-0000-0000-000000000002') $$,
  'P0001', 'invalid_target', 'D-32 보관 자재에는 메모를 달 수 없다');
select throws_ok($$ insert into public.requests (project_id, company_id, author_id, title, body, target_type, target_id)
  values ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'x', 'x', 'designs', 'd1000000-0000-0000-0000-000000000009') $$,
  'P0001', 'invalid_target', 'D-32 다른 프로젝트 항목에는 연결할 수 없다');
select throws_ok($$ insert into public.requests (project_id, company_id, author_id, title, body, target_type, target_id)
  values ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'x', 'x', 'designs', 'd1000000-0000-0000-0000-0000000000ff') $$,
  'P0001', 'invalid_target', 'D-32 없는 항목에는 연결할 수 없다');
select throws_ok($$ insert into public.requests (project_id, company_id, author_id, title, body, target_type)
  values ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'x', 'x', 'designs') $$,
  '23514', NULL, 'D-32 종류와 id 는 함께');
select throws_ok($$ insert into public.requests (project_id, company_id, author_id, title, body, target_type, target_id)
  values ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'x', 'x', 'photos', 'd1000000-0000-0000-0000-000000000001') $$,
  '23514', NULL, 'D-32 도안 · 자재만 연결');

-- 열람: 다른 고객은 남의 메모를 못 본다, 편집자는 본다
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select is_empty($$ select 1 from public.requests where target_id = 'd1000000-0000-0000-0000-000000000001' $$,
  'D-32 같은 도안이라도 다른 고객의 메모는 보이지 않는다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from public.requests where target_id = 'd1000000-0000-0000-0000-000000000001'), 1,
  'D-32 편집자는 항목 메모를 본다');
-- 연결은 바꿀 수 없다
select throws_ok($$ update public.requests set target_id = 'd2000000-0000-0000-0000-000000000001', target_type = 'materials'
  where id = 'a2000000-0000-0000-0000-000000000001' $$, 'P0001', 'immutable_column:target', 'D-32 연결 항목은 바꿀 수 없다');
-- 편집자는 메모를 직접 만들 수 없다 (기존 규칙: 요청은 고객만)
select throws_ok($$ insert into public.requests (project_id, company_id, author_id, title, body, target_type, target_id)
  values ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'x', 'x', 'designs', 'd1000000-0000-0000-0000-000000000001') $$,
  '42501', NULL, 'D-33 편집자는 메모를 만들지 않고 답변한다');
select lives_ok($$ insert into public.request_replies (request_id, project_id, company_id, author_id, body)
  values ('a2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', '밝은 톤으로 바꿔 볼게요') $$,
  'D-33 편집자 답변');
-- 시공팀은 메모를 볼 수 없다
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
select is_empty($$ select 1 from public.requests $$, 'D-32 시공팀은 메모를 볼 수 없다');

select * from finish();
rollback;

-- b_designs_materials_estimates.test.sql
-- B(류영걸) 도안·자재·견적 테스트 — TC-100~199
-- 실행: supabase test db (pgTAP). 각 파일은 트랜잭션 안에서 실행되고 끝에 롤백된다.
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

-- =========================== B: 도안·자재·견적 ===========================

-- TC-101 도안 생성 RPC (pm1, 파일 f1)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select isnt(public.create_design('b0000000-0000-0000-0000-000000000001', '거실 평면도', '', 'f0000000-0000-0000-0000-000000000001', '초안', false),
  null, 'TC-101 도안과 1번 버전을 함께 생성한다');
select is((select current_version from public.designs where title = '거실 평면도'), 1, 'TC-101 현재 버전 = 1');
select throws_ok($$ select public.create_design('b0000000-0000-0000-0000-000000000001', '남의 파일', '', 'f0000000-0000-0000-0000-000000000007', '', false) $$,
  'P0001', 'file_not_owned', 'TC-101 다른 사람이 올린 파일은 연결할 수 없다');
select throws_ok($$ select public.create_design('b0000000-0000-0000-0000-000000000002', '미배정', '', 'f0000000-0000-0000-0000-000000000002', '', false) $$,
  'P0001', 'forbidden', 'TC-101 미배정 프로젝트에는 도안을 만들 수 없다');
select throws_ok($$ select public.create_design('b0000000-0000-0000-0000-000000000001', '재사용', '', 'f0000000-0000-0000-0000-000000000001', '', false) $$,
  '23505', null, 'TC-101 이미 연결된 파일은 다시 쓸 수 없다');
select throws_ok($$ insert into public.designs (project_id, company_id, title, created_by)
                    values ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '직접', 'a0000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'TC-101 도안은 RPC 로만 만든다');

-- TC-100 고객: 비공개 도안 비노출 → 공개 후 노출
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select is_empty($$ select 1 from public.designs $$, 'TC-100 고객은 비공개 도안을 볼 수 없다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
update public.designs set is_public = true where title = '거실 평면도';
select throws_ok($$ update public.designs set current_version = 9 where title = '거실 평면도' $$,
  'P0001', 'system_column:current_version', 'TC-106 시스템 컬럼은 직접 바꿀 수 없다');

-- TC-102 새 버전: 고객은 현재 버전만
select isnt(public.add_design_version((select id from public.designs where title = '거실 평면도'), 'f0000000-0000-0000-0000-000000000002', '치수 수정'),
  null, 'TC-102 새 버전 추가');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select results_eq($$ select version_no from public.design_versions $$, $$ values (2) $$, 'TC-102 고객은 현재 버전(2)만 본다');
select ok(exists (select 1 from public.files where id = 'f0000000-0000-0000-0000-000000000002'), 'TC-103 고객은 현재 버전 파일 행을 조회할 수 있다');
select is_empty($$ select 1 from public.files where id = 'f0000000-0000-0000-0000-000000000001' $$, 'TC-103 고객은 이전 버전 파일을 조회할 수 없다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from public.design_versions), 2, 'TC-102 PM 은 모든 버전을 본다');

-- TC-110 자재 생성·공개 알림
insert into public.materials (id, project_id, company_id, name, category, space, spec, quantity, unit, unit_price, image_file_id, is_public)
values ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002',
        '포세린 타일', '타일', 'bathroom', '600x600 무광', 12.5, '㎡', 45000, 'f0000000-0000-0000-0000-000000000003', true);
select is((select company_id from public.materials where id = 'd0000000-0000-0000-0000-000000000001'), 'c0000000-0000-0000-0000-000000000001'::uuid,
  'TC-111 company_id 는 프로젝트에서 강제로 채워진다 (위조 무시)');
select is((select owner_type from public.files where id = 'f0000000-0000-0000-0000-000000000003'), 'materials', 'TC-111 자재 이미지가 자재에 연결된다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select ok(exists (select 1 from public.notifications where type = 'item_published' and object_id = 'd0000000-0000-0000-0000-000000000001'),
  'TC-113 공개 자재 알림이 고객에게 생성된다');
select ok(exists (select 1 from public.files where id = 'f0000000-0000-0000-0000-000000000003'), 'TC-112 고객은 공개 자재 이미지를 조회할 수 있다');

-- TC-120 확정
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select throws_ok($$ select public.confirm_target('materials', 'd0000000-0000-0000-0000-000000000001', 1) $$,
  'P0001', 'forbidden', 'TC-120 확정권 없는 고객은 확정할 수 없다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select throws_ok($$ select public.confirm_target('materials', 'd0000000-0000-0000-0000-000000000001', 7) $$,
  'P0001', 'stale_revision', 'TC-120 오래된 화면(리비전 불일치)에서는 확정할 수 없다');
select isnt(public.confirm_target('materials', 'd0000000-0000-0000-0000-000000000001', 1), null, 'TC-120 지정 고객 확정 성공');
select throws_ok($$ select public.confirm_target('materials', 'd0000000-0000-0000-0000-000000000001', 1) $$,
  'P0001', 'already_confirmed', 'TC-120 중복 확정은 거절된다');
select is((select confirm_state::text from public.materials where id = 'd0000000-0000-0000-0000-000000000001'), 'confirmed', 'TC-120 상태 = confirmed');

-- TC-121 확정 후 핵심 필드 변경 → 재확인 필요
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
update public.materials set description = '시공 시 줄눈 회색' where id = 'd0000000-0000-0000-0000-000000000001';
select is((select confirm_state::text from public.materials where id = 'd0000000-0000-0000-0000-000000000001'), 'confirmed',
  'TC-121 비핵심 필드 변경은 확정을 유지한다');
update public.materials set unit_price = 48000 where id = 'd0000000-0000-0000-0000-000000000001';
select results_eq($$ select confirm_state::text, revision from public.materials where id = 'd0000000-0000-0000-0000-000000000001' $$,
  $$ values ('needs_reconfirm'::text, 2) $$, 'TC-121 핵심 필드 변경 → 재확인 필요, 리비전 2');
select ok(exists (select 1 from public.confirmations where target_id = 'd0000000-0000-0000-0000-000000000001'
                  and invalidated_reason = 'core_changed'), 'TC-121 기존 확정 기록은 보존되고 무효화 사유가 남는다');
select throws_ok($$ update public.materials set confirm_state = 'confirmed' where id = 'd0000000-0000-0000-0000-000000000001' $$,
  'P0001', 'system_column:confirm_state', 'TC-121 PM 은 확정 상태를 직접 바꿀 수 없다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select ok(exists (select 1 from public.notifications where type = 'reconfirm_requested'), 'TC-121 확정권 고객에게 재확인 알림');
select isnt(public.confirm_target('materials', 'd0000000-0000-0000-0000-000000000001', 2), null, 'TC-121 새 리비전 재확정 가능');

-- TC-121 PM 재확인 요청
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$ select public.request_reconfirm('materials', 'd0000000-0000-0000-0000-000000000001', '') $$,
  'P0001', 'reason_required', 'TC-121 재확인 요청에는 사유가 필요하다');
select lives_ok($$ select public.request_reconfirm('materials', 'd0000000-0000-0000-0000-000000000001', '색상 재검토') $$,
  'TC-121 PM 재확인 요청');

-- TC-131 견적 버전 번호·공개
insert into public.estimates (id, project_id, company_id, title, created_by)
values ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '1차 견적', 'a0000000-0000-0000-0000-000000000002');
insert into public.estimate_versions (estimate_id, project_id, company_id, version_no, version_label, file_id, change_note, is_public, uploaded_by)
values ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 99, 'v1', 'f0000000-0000-0000-0000-000000000004', '최초', true, 'a0000000-0000-0000-0000-000000000002'),
       ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 99, 'v2', 'f0000000-0000-0000-0000-000000000005', '욕실 추가', false, 'a0000000-0000-0000-0000-000000000002');
select results_eq($$ select version_no from public.estimate_versions order by version_no $$, $$ values (1), (2) $$,
  'TC-131 버전 번호는 서버가 1부터 부여한다 (클라이언트 값 무시)');
select isnt((select published_at from public.estimate_versions where version_label = 'v1'), null, 'TC-133 공개 버전은 공개 시각이 기록된다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select results_eq($$ select version_label from public.estimate_versions $$, $$ values ('v1'::text) $$, 'TC-132 고객은 공개 버전만 본다');
select is_empty($$ select 1 from public.files where id = 'f0000000-0000-0000-0000-000000000005' $$, 'TC-132 고객은 비공개 버전 PDF 를 조회할 수 없다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
select is_empty($$ select 1 from public.materials $$, 'TC-902 시공팀은 자재를 볼 수 없다');
select is_empty($$ select 1 from public.estimate_versions $$, 'TC-902 시공팀은 견적을 볼 수 없다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
select is_empty($$ select 1 from public.designs $$, 'TC-901 타 업체는 도안을 볼 수 없다');
reset role;

select * from finish();
rollback;

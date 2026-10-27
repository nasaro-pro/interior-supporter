-- b_p2_reconfirm.test.sql
-- B(류영걸) 파트 2 신규 마이그레이션 검증 — DB-01, DB-02, DB-04(B) (20261013000200~210)
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

-- ===== DB-01 재확인 요청 후 같은 리비전 재확정 =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select set_config('test.design',
  public.create_design('b0000000-0000-0000-0000-000000000001', '거실 도안', '', 'f0000000-0000-0000-0000-000000000001', '', true)::text, true);
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select lives_ok($$ select public.confirm_target('designs', current_setting('test.design')::uuid, 1) $$, 'DB-01 확정권 고객 cust1 첫 확정');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok($$ select public.request_reconfirm('designs', current_setting('test.design')::uuid, '색상 재검토 부탁드립니다') $$, 'DB-01 PM 재확인 요청');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select lives_ok($$ select public.confirm_target('designs', current_setting('test.design')::uuid, 1) $$,
  'DB-01 재확인 요청 뒤 같은 리비전으로 다시 확정할 수 있다');
select throws_ok($$ select public.confirm_target('designs', current_setting('test.design')::uuid, 1) $$,
  'P0001', 'already_confirmed', 'DB-01 확정 상태에서 다시 확정하면 already_confirmed');
reset role;
select is((select count(*)::int from public.confirmations where target_id = current_setting('test.design')::uuid), 2, 'DB-01 확정 기록 2건 보존');
select is((select count(*)::int from public.confirmations where target_id = current_setting('test.design')::uuid and invalidated_at is null), 1, 'DB-01 유효 확정은 1건');
select is((select confirm_state::text from public.designs where id = current_setting('test.design')::uuid), 'confirmed', 'DB-01 도안 상태 = confirmed');

-- ===== DB-02 재확인 사유 500자 =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok($$ select public.request_reconfirm('designs', current_setting('test.design')::uuid, repeat('가', 500)) $$, 'DB-02 사유 500자 허용');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select lives_ok($$ select public.confirm_target('designs', current_setting('test.design')::uuid, 1) $$, 'DB-02 (재확정)');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$ select public.request_reconfirm('designs', current_setting('test.design')::uuid, repeat('가', 501)) $$,
  'P0001', 'reason_required', 'DB-02 사유 501자는 reason_required');

-- ===== DB-04 estimates.created_by 트리거 =====
-- (D-37 · CR-9: 견적 쓰기는 업체관리자만 — 소유자 owner1 로 확인)
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($$ insert into public.estimates (id, project_id, company_id, title) values
  ('e1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '1차 견적') $$,
  'DB-04 created_by 를 보내지 않아도 견적이 만들어진다');
select is((select created_by from public.estimates where id = 'e1000000-0000-0000-0000-000000000001'), 'a0000000-0000-0000-0000-000000000001'::uuid, 'DB-04 created_by = 호출자');
select lives_ok($$ insert into public.estimates (id, project_id, company_id, title, created_by) values
  ('e1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '2차 견적', 'a0000000-0000-0000-0000-000000000002') $$,
  'DB-04 다른 사람 id 를 보내도');
select is((select created_by from public.estimates where id = 'e1000000-0000-0000-0000-000000000002'), 'a0000000-0000-0000-0000-000000000001'::uuid, 'DB-04 created_by 는 호출자로 덮어써진다 (위조 불가)');
reset role;
select has_trigger('public', 'design_previews', 'a_created_by', 'DB-04 design_previews 에도 created_by 트리거');

select * from finish();
rollback;

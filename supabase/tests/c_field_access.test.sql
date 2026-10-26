-- c_field_access.test.sql
-- 시공팀 열람 검증 — 통합본 7장 F1·F2·F8·F9·F11 (20261026000200_c_field_access.sql)
-- 실행: npm run db:test (Supabase CLI test db). 트랜잭션 안에서 실행 후 롤백.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;
select * from no_plan();

-- ---- 시드: owner(…01) 업체 소유자 / crew(…05) 배정 중 시공팀 / crew2(…06) 배정 끝난 시공팀 / cust(…04) 고객 ----
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'owner@test.local', '{"display_name":"소유자"}'),
  ('a0000000-0000-0000-0000-000000000005', 'crew@test.local',  '{"display_name":"시공팀"}'),
  ('a0000000-0000-0000-0000-000000000006', 'crew2@test.local', '{"display_name":"끝난팀"}'),
  ('a0000000-0000-0000-0000-000000000004', 'cust@test.local',  '{"display_name":"고객"}');
insert into public.companies (id, slug, name, created_by) values
  ('c0000000-0000-0000-0000-000000000001', 'studio-one', '스튜디오 원', 'a0000000-0000-0000-0000-000000000001');
insert into public.company_settings (company_id) values ('c0000000-0000-0000-0000-000000000001');
insert into public.company_members (company_id, user_id, role) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner');
insert into public.projects (id, company_id, name, site_address, is_public, created_by) values
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '현장A', '서울', true, 'a0000000-0000-0000-0000-000000000001');
insert into public.project_participants (project_id, company_id, user_id, role, valid_from, valid_until) values
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 'field', current_date - 1, current_date + 10),
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000006', 'field', current_date - 20, current_date - 5);
insert into public.project_participants (project_id, company_id, user_id, role) values
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'customer');
-- 일정 1, 확정 도안 1(+미확정 1), 확정 자재 1
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
set app.system_write = 'on';
insert into public.schedule_events (id, company_id, project_id, title, start_date, created_by, is_public) values
  ('d1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '목공', current_date, 'a0000000-0000-0000-0000-000000000001', true);
insert into public.files (id, company_id, project_id, kind, path, original_name, mime, size_bytes, status, uploaded_by) values
  ('e0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'design_original', 'd/plan.pdf', 'plan.pdf', 'application/pdf', 100, 'ready', 'a0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'design_preview', 'd/p.webp', 'p.webp', 'image/webp', 100, 'ready', 'a0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'material_image', 'm/t.webp', 't.webp', 'image/webp', 100, 'ready', 'a0000000-0000-0000-0000-000000000001');
insert into public.designs (id, company_id, project_id, title, is_public, confirm_state, current_version, created_by) values
  ('d2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '거실 도안', true, 'confirmed', 1, 'a0000000-0000-0000-0000-000000000001'),
  ('d2000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '미확정', true, 'none', 0, 'a0000000-0000-0000-0000-000000000001');
insert into public.design_versions (id, company_id, project_id, design_id, version_no, file_id, uploaded_by) values
  ('d3000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 1, 'e0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001');
insert into public.design_previews (id, company_id, project_id, design_id, design_version_id, file_id, label, created_by) values
  ('d4000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000012', '거실', 'a0000000-0000-0000-0000-000000000001');
insert into public.materials (id, company_id, project_id, name, unit_price, image_file_id, is_public, confirm_state, created_by) values
  ('d5000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '타일', 30000, 'e0000000-0000-0000-0000-000000000013', true, 'confirmed', 'a0000000-0000-0000-0000-000000000001');
update public.files set owner_type = 'design_versions', owner_id = 'd3000000-0000-0000-0000-000000000001' where id = 'e0000000-0000-0000-0000-000000000011';
update public.files set owner_type = 'design_previews', owner_id = 'd4000000-0000-0000-0000-000000000001' where id = 'e0000000-0000-0000-0000-000000000012';
update public.materials set confirm_state = 'confirmed' where id = 'd5000000-0000-0000-0000-000000000001';
update public.files set owner_type = 'materials', owner_id = 'd5000000-0000-0000-0000-000000000001' where id = 'e0000000-0000-0000-0000-000000000013';
reset app.system_write;
select set_config('request.jwt.claims', '', true);

set local role authenticated;

-- ===== F1 현장 목록 · F2 기본 모두 꺼짐 =====
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select ok((select not show_schedule and not show_designs and not show_materials from public.field_site('b0000000-0000-0000-0000-000000000001')), 'F2 설정 없으면 탭 모두 꺼짐');
select is_empty($$ select * from public.field_schedule('b0000000-0000-0000-0000-000000000001') $$, 'F2 일정 탭 꺼짐 → 0행');
select is_empty($$ select * from public.field_designs('b0000000-0000-0000-0000-000000000001') $$, 'F2 도안 탭 꺼짐 → 0행');
select ok((select name = '현장A' and valid_until = current_date + 10 and today_events = '{}' from public.field_sites()), 'F1 현장 카드: 배정 기간, 일정 탭 꺼지면 오늘 일정 숨김');
select is((select count(*) from public.files where id in ('e0000000-0000-0000-0000-000000000011','e0000000-0000-0000-0000-000000000012','e0000000-0000-0000-0000-000000000013')), 0::bigint, 'F2 탭 꺼짐 → 도안·자재 파일 안 보임');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
select is_empty($$ select * from public.field_sites() $$, 'POL-006 배정 끝난 시공팀 현장 목록 0행');
select is_empty($$ select * from public.field_site('b0000000-0000-0000-0000-000000000001') $$, 'POL-006 배정 끝난 시공팀 현장 0행');

-- ===== F2 설정은 담당자만 =====
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select throws_ok($$ insert into public.project_field_settings (project_id, show_schedule) values ('b0000000-0000-0000-0000-000000000001', true) $$,
  '42501', null, 'F2 시공팀은 탭 설정 불가');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($$ insert into public.project_field_settings (project_id, show_schedule, show_designs, show_materials)
  values ('b0000000-0000-0000-0000-000000000001', true, true, true) $$, 'F2 담당자가 탭 켬');

-- ===== F2 켜진 탭은 보기만 =====
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select is((select count(*) from public.field_schedule('b0000000-0000-0000-0000-000000000001')), 1::bigint, 'F2 일정 보임');
select ok((select title = '거실 도안' and preview_file_ids = array['e0000000-0000-0000-0000-000000000012'::uuid] from public.field_designs('b0000000-0000-0000-0000-000000000001')),
  'F2 확정 도안만, 미리보기 포함');
select is((select count(*) from public.field_designs('b0000000-0000-0000-0000-000000000001')), 1::bigint, 'F2 미확정 도안 제외');
select is((select count(*) from public.field_materials('b0000000-0000-0000-0000-000000000001')), 1::bigint, 'F2 확정 자재 보임');
select ok((select today_events = array['목공'] from public.field_sites()), 'F1 일정 탭 켜면 오늘 일정 보임');
select is((select count(*) from public.files where id in ('e0000000-0000-0000-0000-000000000011','e0000000-0000-0000-0000-000000000012','e0000000-0000-0000-0000-000000000013')), 3::bigint, 'F2 확정 도안·자재 파일 열람');
select is((select count(*) from public.designs), 0::bigint, 'F2 도안 표 직접 조회는 여전히 불가');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
update public.project_field_settings set show_designs = false, show_materials = false where project_id = 'b0000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select is((select count(*) from public.files where id in ('e0000000-0000-0000-0000-000000000011','e0000000-0000-0000-0000-000000000012','e0000000-0000-0000-0000-000000000013')), 0::bigint, 'F2 탭 다시 끄면 파일 안 보임');

-- ===== F9 시공팀 사진 공개 =====
insert into public.files (id, company_id, project_id, kind, path, original_name, mime, size_bytes, status, uploaded_by) values
  ('e0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'photo_original', 'p/21.jpg', '21.jpg', 'image/jpeg', 10, 'pending', 'a0000000-0000-0000-0000-000000000005');
reset role;
update public.files set status = 'ready' where id = 'e0000000-0000-0000-0000-000000000021';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
insert into public.photos (id, project_id, file_id, is_public, uploaded_by) values
  ('f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000021', true, 'a0000000-0000-0000-0000-000000000005');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
update public.project_field_settings set photo_auto_public = true where project_id = 'b0000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
insert into public.files (id, company_id, project_id, kind, path, original_name, mime, size_bytes, status, uploaded_by) values
  ('e0000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'photo_original', 'p/22.jpg', '22.jpg', 'image/jpeg', 10, 'pending', 'a0000000-0000-0000-0000-000000000005');
reset role;
update public.files set status = 'ready' where id = 'e0000000-0000-0000-0000-000000000022';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select ok((select photo_auto_public from public.field_site('b0000000-0000-0000-0000-000000000001')), 'F9 현장 정보에 바로 공개 여부');
insert into public.photos (id, project_id, file_id, uploaded_by) values
  ('f0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000005');
reset role;
select ok((select not is_public from public.photos where id = 'f0000000-0000-0000-0000-000000000001'), 'F9 바로 공개 꺼짐 → 숨김 저장');
select ok((select is_public from public.photos where id = 'f0000000-0000-0000-0000-000000000002'), 'F9 바로 공개 켜짐 → 공개 저장');
set local role authenticated;

-- ===== F8 본인 사진 보관 (공개 전만) =====
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select lives_ok($$ update public.photos set archived_at = now() where id = 'f0000000-0000-0000-0000-000000000001' $$, 'F8 공개 전 본인 사진 보관');
select throws_ok($$ update public.photos set archived_at = now() where id = 'f0000000-0000-0000-0000-000000000002' $$,
  'P0001', 'forbidden', 'F8 공개된 사진은 시공팀이 보관 불가');

-- ===== F11 일정 변경 알림 =====
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
update public.schedule_events set start_date = current_date + 1 where id = 'd1000000-0000-0000-0000-000000000001';
reset role;
select ok(exists (select 1 from public.notifications where recipient_id = 'a0000000-0000-0000-0000-000000000005' and type = 'schedule_changed'),
  'F11 일정 탭 켜진 시공팀 알림');
select ok(not exists (select 1 from public.notifications where recipient_id = 'a0000000-0000-0000-0000-000000000006' and type = 'schedule_changed'),
  'F11 배정 끝난 시공팀 알림 없음');
update public.project_field_settings set show_schedule = false where project_id = 'b0000000-0000-0000-0000-000000000001';
select is((select count(*) from public.notifications where recipient_id = 'a0000000-0000-0000-0000-000000000005' and type = 'schedule_changed'), 1::bigint, 'F11 기준 1건');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
update public.schedule_events set start_date = current_date + 2 where id = 'd1000000-0000-0000-0000-000000000001';
reset role;
select is((select count(*) from public.notifications where recipient_id = 'a0000000-0000-0000-0000-000000000005' and type = 'schedule_changed'), 1::bigint,
  'F11 일정 탭 끄면 시공팀 알림 없음');

select * from finish();
rollback;

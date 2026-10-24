-- c_requests_photos_schedule.test.sql
-- C(이재서) 요청·사진·일정 테스트 — TC-200~299
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

-- =========================== C: 요청·사진·일정 ===========================

-- TC-201 고객 요청 작성
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
insert into public.requests (id, project_id, company_id, author_id, title, body, status)
values ('a1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000004', '주방 콘센트 추가', '아일랜드 쪽에 2구 콘센트를 추가해 주세요.', 'resolved');
select is((select status::text from public.requests where id = 'a1000000-0000-0000-0000-000000000001'), 'open',
  'TC-201 새 요청 상태는 서버가 open 으로 강제한다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select ok(exists (select 1 from public.notifications where type = 'request_created' and object_id = 'a1000000-0000-0000-0000-000000000001'),
  'TC-201 PM 에게 요청 알림이 생성된다');
select throws_ok($$ insert into public.requests (project_id, company_id, author_id, title, body)
                    values ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'PM 작성', '본문') $$,
  '42501', null, 'TC-201 PM 은 고객 요청을 대신 작성할 수 없다');

-- TC-202 원문 불변
select throws_ok($$ update public.requests set body = '바뀐 원문' where id = 'a1000000-0000-0000-0000-000000000001' $$,
  'P0001', 'immutable_column:body', 'TC-202 요청 원문은 수정할 수 없다');

-- TC-203 정정: 작성자만 / TC-200 같은 프로젝트의 다른 고객은 열람 불가 (D03)
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select is_empty($$ select 1 from public.requests where id = 'a1000000-0000-0000-0000-000000000001' $$, 'TC-200 같은 프로젝트의 다른 고객은 남의 요청을 볼 수 없다');
select throws_ok($$ insert into public.request_corrections (request_id, project_id, company_id, author_id, body)
                    values ('a1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', '대리 정정') $$,
  '42501', null, 'TC-203 작성자가 아닌 고객은 정정을 추가할 수 없다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select lives_ok($$ insert into public.request_corrections (request_id, project_id, company_id, author_id, body)
                   values ('a1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', '3구로 정정합니다') $$,
  'TC-203 작성자는 정정을 추가할 수 있다');
select throws_ok($$ insert into public.request_replies (request_id, project_id, company_id, author_id, body)
                    values ('a1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', '셀프 답변') $$,
  '42501', null, 'TC-204 고객은 답변을 작성할 수 없다');

-- TC-204/205 답변·상태 변경 → 고객 알림
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok($$ insert into public.request_replies (request_id, project_id, company_id, author_id, body)
                   values ('a1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', '반영하겠습니다') $$,
  'TC-204 PM 답변 작성');
update public.requests set status = 'in_progress' where id = 'a1000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select is_empty($$ select 1 from public.notifications where type in ('request_replied', 'request_status_changed') $$, 'TC-204 작성자가 아닌 고객에게는 답변·상태 알림이 가지 않는다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select ok(exists (select 1 from public.notifications where type = 'request_replied'), 'TC-204 작성자에게 답변 알림');
select ok(exists (select 1 from public.notifications where type = 'request_status_changed'), 'TC-205 작성자에게 상태 변경 알림');
select ok(exists (select 1 from public.requests where id = 'a1000000-0000-0000-0000-000000000001'), 'TC-200 작성자는 자기 요청을 본다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
select is_empty($$ select 1 from public.requests $$, 'TC-902 시공팀은 고객 요청을 볼 수 없다');

-- TC-221 시공팀 사진 업로드: 비공개 강제
insert into public.photos (id, project_id, company_id, file_id, phase, captured_on, description, is_public, uploaded_by, uploader_role)
values ('a2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000006', 'tile', private.today_kst(), '욕실 벽 타일', true,
        'a0000000-0000-0000-0000-000000000006', 'staff');
select results_eq($$ select is_public, uploader_role from public.photos where id = 'a2000000-0000-0000-0000-000000000001' $$,
  $$ values (false, 'field'::text) $$, 'TC-221 시공팀 업로드는 비공개·field 로 강제된다');
select throws_ok($$ update public.photos set is_public = true where id = 'a2000000-0000-0000-0000-000000000001' $$,
  'P0001', 'forbidden', 'TC-221 시공팀은 사진을 공개할 수 없다');
select lives_ok($$ update public.photos set description = '욕실 벽 타일 1차' where id = 'a2000000-0000-0000-0000-000000000001' $$,
  'TC-222 시공팀은 본인 사진 설명을 고칠 수 있다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select is_empty($$ select 1 from public.photos $$, 'TC-212 고객은 비공개 사진을 볼 수 없다');
select is_empty($$ select 1 from public.files where id = 'f0000000-0000-0000-0000-000000000006' $$, 'TC-212 고객은 비공개 사진 파일을 조회할 수 없다');

-- TC-213 PM 공개 → 고객 노출·알림
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select ok(exists (select 1 from public.notifications where type = 'photo_uploaded'), 'TC-221 PM 에게 시공팀 업로드 알림');
update public.photos set is_public = true where id = 'a2000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select ok(exists (select 1 from public.photos where id = 'a2000000-0000-0000-0000-000000000001'), 'TC-213 공개 후 고객이 사진을 본다');
select ok(exists (select 1 from public.files where id = 'f0000000-0000-0000-0000-000000000006'), 'TC-213 공개 후 고객이 사진 파일을 조회할 수 있다');
select ok(exists (select 1 from public.notifications where type = 'photo_published'), 'TC-213 고객에게 사진 공개 알림');

-- TC-231 일정 검증·공개 범위
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$ insert into public.schedule_events (project_id, company_id, title, start_date, end_date, created_by)
                    values ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '역전', '2026-10-10', '2026-10-09', 'a0000000-0000-0000-0000-000000000002') $$,
  '23514', null, 'TC-231 종료일이 시작일보다 앞서면 거절');
select throws_ok($$ insert into public.schedule_events (project_id, company_id, title, start_date, start_time, end_time, created_by)
                    values ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '시각 역전', '2026-10-10', '11:00', '09:00', 'a0000000-0000-0000-0000-000000000002') $$,
  '23514', null, 'TC-231 같은 날 종료 시각이 시작 시각보다 앞서면 거절');
insert into public.schedule_events (project_id, company_id, title, start_date, start_time, end_time, is_public, created_by) values
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '타일 시공', '2026-10-12', '09:30', '18:00', true,  'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '내부 회의', '2026-10-13', null, null, false, 'a0000000-0000-0000-0000-000000000002');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select results_eq($$ select title from public.schedule_events $$, $$ values ('타일 시공'::text) $$, 'TC-232 고객은 공개 일정만 본다');
select ok(exists (select 1 from public.notifications where type = 'schedule_changed'), 'TC-232 공개 일정 알림');
select throws_ok($$ insert into public.schedule_events (project_id, company_id, title, start_date, created_by)
                    values ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '고객 일정', '2026-10-20', 'a0000000-0000-0000-0000-000000000004') $$,
  '42501', null, 'TC-231 고객은 일정을 만들 수 없다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
select is_empty($$ select 1 from public.photos $$, 'TC-901 타 업체는 사진을 볼 수 없다');
select is_empty($$ select 1 from public.schedule_events $$, 'TC-901 타 업체는 일정을 볼 수 없다');
reset role;

select * from finish();
rollback;

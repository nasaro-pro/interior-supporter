-- c_p4_photo_comments.test.sql
-- C D-34 현장 사진 댓글 (20261025000400)
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

-- pm1 을 P1 담당자로 (알림 수신) · 사진 ph1(공개) · ph2(비공개)
insert into public.project_participants (project_id, company_id, user_id, role)
values ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'pm') on conflict do nothing;
insert into public.files (id, company_id, project_id, kind, path, original_name, mime, size_bytes, status, uploaded_by) values
  ('f0000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'photo_original', 'test/a1.jpg', 'a1.jpg', 'image/jpeg', 1000, 'ready', 'a0000000-0000-0000-0000-000000000002'),
  ('f0000000-0000-0000-0000-0000000000a2', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'photo_original', 'test/a2.jpg', 'a2.jpg', 'image/jpeg', 1000, 'ready', 'a0000000-0000-0000-0000-000000000002');
alter table public.photos disable trigger user;
insert into public.photos (id, company_id, project_id, file_id, is_public, uploaded_by, uploader_role) values
  ('70000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-0000000000a1', true,  'a0000000-0000-0000-0000-000000000002', 'staff'),
  ('70000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-0000000000a2', false, 'a0000000-0000-0000-0000-000000000002', 'staff');
alter table public.photos enable trigger user;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select lives_ok($$ insert into public.photo_comments (photo_id, author_id, thread_owner, body)
  values ('70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', '이 벽 색이 맞나요?') $$, 'D-34 고객은 공개 사진에 댓글');
select is((select project_id from public.photo_comments limit 1), 'b0000000-0000-0000-0000-000000000001'::uuid, '범위는 사진에서 복사');
select throws_ok($$ insert into public.photo_comments (photo_id, author_id, thread_owner, body)
  values ('70000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', '비공개') $$, '42501', NULL, 'D-34 비공개 사진에는 댓글 불가');
select throws_ok($$ insert into public.photo_comments (photo_id, author_id, thread_owner, body)
  values ('70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000005', '남의 대화') $$, '42501', NULL, 'D-34 고객은 남의 대화에 쓸 수 없다');
select throws_ok($$ insert into public.photo_comments (photo_id, author_id, thread_owner, body)
  values ('70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', '') $$, '23514', NULL, '빈 댓글 불가');

-- 알림: 담당자에게
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select ok(exists (select 1 from public.notifications where type = 'photo_commented' and object_id = '70000000-0000-0000-0000-000000000001'
  and recipient_id = 'a0000000-0000-0000-0000-000000000002'), 'D-34 고객 댓글 → 담당자 알림');

-- 편집자 답글
select lives_ok($$ insert into public.photo_comments (photo_id, author_id, thread_owner, body)
  values ('70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', '네, 샘플 확인했습니다') $$, 'D-34 편집자는 고객 대화에 답글');
select throws_ok($$ insert into public.photo_comments (photo_id, author_id, thread_owner, body)
  values ('70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000005', '먼저 말 걸기') $$, '42501', NULL, 'D-34 댓글 없는 고객에게 먼저 답글을 달 수 없다');
select throws_ok($$ insert into public.photo_comments (photo_id, author_id, thread_owner, body)
  values ('70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', '혼잣말') $$, '42501', NULL, 'D-34 편집자는 자기 대화를 만들지 않는다');
select is((select count(*)::int from public.photo_comments), 2, '편집자는 전체 댓글을 본다');
select throws_ok($$ update public.photo_comments set body = '수정' $$, '42501', NULL, '수정 불가 (추가 전용)');

-- 열람 범위
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select is((select count(*)::int from public.photo_comments), 2, '고객은 자기 대화(댓글 + 답글)를 본다');
select ok(exists (select 1 from public.notifications where type = 'photo_comment_replied' and recipient_id = 'a0000000-0000-0000-0000-000000000004'),
  'D-34 답글 → 그 고객 알림');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select is_empty($$ select 1 from public.photo_comments $$, 'D-34 다른 고객은 남의 댓글을 못 본다');
select is_empty($$ select 1 from public.notifications where type = 'photo_comment_replied' $$, '다른 고객에게 답글 알림 없음');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
select is_empty($$ select 1 from public.photo_comments $$, 'D-34 시공팀은 댓글을 보지 않는다');
select throws_ok($$ insert into public.photo_comments (photo_id, author_id, thread_owner, body)
  values ('70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', '시공팀') $$, '42501', NULL, 'D-34 시공팀은 댓글을 쓸 수 없다');

-- 사진을 비공개로 돌리면 고객에게서 사라진다
reset role;
alter table public.photos disable trigger user;
update public.photos set is_public = false where id = '70000000-0000-0000-0000-000000000001';
alter table public.photos enable trigger user;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select is_empty($$ select 1 from public.photo_comments $$, '비공개 사진의 댓글은 고객에게 안 보인다');

select * from finish();
rollback;

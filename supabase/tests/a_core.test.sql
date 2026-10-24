-- a_core.test.sql
-- A(박예원) 공통 기반 RLS·RPC 테스트 — TC-001~099, TC-900대
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

-- =========================== A: 공통 기반 ===========================

-- TC-905 모든 public 테이블 RLS 활성
select is_empty($$ select tablename from pg_tables where schemaname = 'public' and not rowsecurity $$,
  'TC-905 모든 public 테이블에 RLS 가 켜져 있다');

-- TC-906 anon 은 업무 테이블 권한 없음
select ok(not has_table_privilege('anon', 'public.projects', 'SELECT'), 'TC-906 anon 은 projects 조회 권한이 없다');
select ok(not has_table_privilege('authenticated', 'public.projects', 'DELETE'), 'TC-906 authenticated 는 DELETE 권한이 없다');

-- TC-010 프로젝트 목록 범위 (owner 전체 / pm 배정분 / 타 업체 없음)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*)::int from public.projects), 2, 'TC-010 owner1 은 업체1 프로젝트 2개를 본다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select results_eq($$ select name from public.projects $$, $$ values ('강남 A현장'::text) $$, 'TC-010 pm1 은 배정된 P1 만 본다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
select is_empty($$ select 1 from public.projects where company_id = 'c0000000-0000-0000-0000-000000000001' $$,
  'TC-901 타 업체 소유자는 업체1 프로젝트를 볼 수 없다');
select is_empty($$ select 1 from public.files where company_id = 'c0000000-0000-0000-0000-000000000001' $$,
  'TC-901 타 업체 소유자는 업체1 파일 행을 볼 수 없다');

-- TC-017 pm1 은 배정되지 않은 P2 를 수정할 수 없다 (0행 갱신)
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
update public.projects set name = '탈취' where id = 'b0000000-0000-0000-0000-000000000002';
reset role;
select is((select name from public.projects where id = 'b0000000-0000-0000-0000-000000000002'), '성수 B현장',
  'TC-017 미배정 프로젝트 수정은 반영되지 않는다');

-- TC-011 프로젝트 생성 → 생성자 pm 자동 배정, 회사 id 위조 불가
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
insert into public.projects (id, company_id, name, created_by)
values ('b0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000001', '신규 현장', 'a0000000-0000-0000-0000-000000000002');
select ok(exists (select 1 from public.project_participants where project_id = 'b0000000-0000-0000-0000-000000000010'
                  and user_id = 'a0000000-0000-0000-0000-000000000002' and role = 'pm'),
  'TC-011 생성자가 pm 참여자로 자동 등록된다');
select throws_ok($$ insert into public.projects (company_id, name, created_by)
                    values ('c0000000-0000-0000-0000-000000000002', '남의 회사', 'a0000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'TC-011 소속 아닌 업체에 프로젝트를 만들 수 없다');

-- TC-016 고객 열람: 공개 프로젝트만, 감사 기록 비노출
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select results_eq($$ select name from public.projects $$, $$ values ('강남 A현장'::text) $$, 'TC-016 고객은 초대된 공개 프로젝트만 본다');
select is_empty($$ select 1 from public.audit_events $$, 'TC-030 고객은 변경이력을 볼 수 없다');
select is_empty($$ select 1 from public.company_settings $$, 'TC-016 고객은 업체 내부 설정을 볼 수 없다');
select ok(exists (select 1 from public.companies where id = 'c0000000-0000-0000-0000-000000000001'),
  'TC-015 고객은 업체명을 볼 수 있다');
reset role;
update public.projects set is_public = false where id = 'b0000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select is_empty($$ select 1 from public.projects $$, 'TC-016 비공개 전환 후 고객은 프로젝트를 볼 수 없다');
reset role;
update public.projects set is_public = true where id = 'b0000000-0000-0000-0000-000000000001';

-- TC-018 배정 회수·기간 만료 즉시 차단
update public.project_participants set revoked_at = now()
 where project_id = 'b0000000-0000-0000-0000-000000000001' and user_id = 'a0000000-0000-0000-0000-000000000005';
update public.project_participants set valid_until = private.today_kst() - 1
 where project_id = 'b0000000-0000-0000-0000-000000000001' and user_id = 'a0000000-0000-0000-0000-000000000006';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select is_empty($$ select 1 from public.projects $$, 'TC-018 회수된 고객은 프로젝트를 볼 수 없다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
select is_empty($$ select 1 from public.projects $$, 'TC-018 기간이 끝난 시공팀은 프로젝트를 볼 수 없다');
reset role;
update public.project_participants set revoked_at = null, valid_until = null
 where project_id = 'b0000000-0000-0000-0000-000000000001';

-- TC-003 초대 생성 권한
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok($$ insert into public.invitations (company_id, project_id, email, participant_role, can_confirm, token_hash, created_by)
  values ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'new@test.local', 'customer', true,
          repeat('a', 64), 'a0000000-0000-0000-0000-000000000002') $$, 'TC-003 프로젝트 편집자는 고객 초대를 만들 수 있다');
select throws_ok($$ insert into public.invitations (company_id, email, member_role, token_hash, created_by)
  values ('c0000000-0000-0000-0000-000000000001', 'staff@test.local', 'pm', repeat('b', 64), 'a0000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'TC-003 일반 PM 은 업체 구성원 초대를 만들 수 없다');
select throws_ok($$ insert into public.invitations (company_id, project_id, email, participant_role, token_hash, created_by)
  values ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'x@test.local', 'field', repeat('c', 64), 'a0000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'TC-003 미배정 프로젝트에는 초대를 만들 수 없다');
reset role;

-- TC-004 초대 수락 (service_role RPC)
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-000000000009', 'NEW@test.local');
select throws_ok($$ select public.accept_invitation('a0000000-0000-0000-0000-000000000008', repeat('a', 64)) $$,
  'P0001', 'invite_email_mismatch', 'TC-004 이메일이 다른 계정은 수락할 수 없다');
select is((public.accept_invitation('a0000000-0000-0000-0000-000000000009', repeat('a', 64)) ->> 'area'), 'portal',
  'TC-004 고객 초대 수락 → portal 영역');
select ok(exists (select 1 from public.project_participants where user_id = 'a0000000-0000-0000-0000-000000000009'
                  and role = 'customer' and can_confirm), 'TC-004 수락 시 확정권 포함 참여자 생성');
select throws_ok($$ select public.accept_invitation('a0000000-0000-0000-0000-000000000009', repeat('a', 64)) $$,
  'P0001', 'invite_used', 'TC-004 1회용 초대는 재사용할 수 없다');
insert into public.invitations (company_id, project_id, email, participant_role, token_hash, created_by, expires_at)
values ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'late@test.local', 'field',
        repeat('d', 64), 'a0000000-0000-0000-0000-000000000002', now() - interval '1 minute');
select throws_ok($$ select public.accept_invitation('a0000000-0000-0000-0000-000000000009', repeat('d', 64)) $$,
  'P0001', 'invite_expired', 'TC-004 만료된 초대는 수락할 수 없다');
select ok(not has_function_privilege('authenticated', 'public.accept_invitation(uuid, text)', 'EXECUTE'),
  'TC-004 accept_invitation 은 사용자가 직접 호출할 수 없다');

-- TC-001 셀프 가입 RPC: slug 중복
select throws_ok($$ select public.create_company_with_owner('a0000000-0000-0000-0000-000000000008', '중복', 'studio-one', '외부인') $$,
  'P0001', 'slug_taken', 'TC-001 이미 쓰인 slug 는 거절');
select isnt(public.create_company_with_owner('a0000000-0000-0000-0000-000000000008', '외부인 스튜디오', 'stranger-co', '외부인'), null,
  'TC-001 새 업체와 소유자 생성');
select ok(not has_function_privilege('authenticated', 'public.create_company_with_owner(uuid, text, text, text)', 'EXECUTE'),
  'TC-001 업체 생성 RPC 는 서버 전용이다');

-- TC-051 owner 역할 잠금
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$ update public.company_members set role = 'pm'
                    where user_id = 'a0000000-0000-0000-0000-000000000001' and company_id = 'c0000000-0000-0000-0000-000000000001' $$,
  'P0001', 'owner_role_locked', 'TC-051 소유자 역할은 변경할 수 없다');
select lives_ok($$ update public.company_members set role = 'manager'
                   where user_id = 'a0000000-0000-0000-0000-000000000003' and company_id = 'c0000000-0000-0000-0000-000000000001' $$,
  'TC-051 소유자는 PM 을 업체 관리자로 지정할 수 있다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is((select count(*)::int from public.projects where company_id = 'c0000000-0000-0000-0000-000000000001'), 3,
  'TC-051 관리자로 지정되면 업체 전체 프로젝트를 본다');

-- TC-031 감사 기록: 행위자·전후 값
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
update public.projects set current_phase = '목공' where id = 'b0000000-0000-0000-0000-000000000001';
select results_eq(
  $$ select actor_id, event_type, after ->> 'current_phase' from public.audit_events
     where object_type = 'projects' and object_id = 'b0000000-0000-0000-0000-000000000001' and event_type = 'updated'
     order by id desc limit 1 $$,
  $$ values ('a0000000-0000-0000-0000-000000000002'::uuid, 'updated'::text, '목공'::text) $$,
  'TC-031 변경 이력에 행위자와 변경 후 값이 남는다');
select throws_ok($$ insert into public.audit_events (object_type, object_id, event_type) values ('x', gen_random_uuid(), 'fake') $$,
  '42501', null, 'TC-031 사용자는 변경이력을 위조할 수 없다');
select ok(not has_table_privilege('authenticated', 'public.audit_events', 'UPDATE'), 'TC-031 변경이력 수정 권한 없음');

-- TC-040 알림: 본인 것만, 읽음 외 변경 불가
reset role;
insert into public.notifications (recipient_id, company_id, project_id, type, object_type, object_id)
values ('a0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
        'item_published', 'materials', gen_random_uuid());
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is_empty($$ select 1 from public.notifications where recipient_id = 'a0000000-0000-0000-0000-000000000004' $$,
  'TC-040 남의 알림은 보이지 않는다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select lives_ok($$ update public.notifications set read_at = now() where recipient_id = 'a0000000-0000-0000-0000-000000000004' $$,
  'TC-040 본인 알림 읽음 처리');
select throws_ok($$ update public.notifications set object_id = gen_random_uuid() where recipient_id = 'a0000000-0000-0000-0000-000000000004' $$,
  'P0001', 'immutable_column:object_id', 'TC-040 알림 대상은 바꿀 수 없다');
reset role;

-- TC-005 비밀번호 재설정 대상 검사
select ok(public.can_issue_password_reset('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004'),
  'TC-005 소유자는 자기 업체 고객의 재설정 링크를 만들 수 있다');
select ok(not public.can_issue_password_reset('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004'),
  'TC-005 일반 PM 은 재설정 링크를 만들 수 없다');
select ok(not public.can_issue_password_reset('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000007'),
  'TC-005 다른 업체 사용자에게는 재설정 링크를 만들 수 없다');

-- TC-021 고객 카드: 프로젝트 1개는 고객 카드 1개에만 연결 (D03)
insert into public.clients (id, company_id, name, created_by) values
  ('a3000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '김고객', 'a0000000-0000-0000-0000-000000000001'),
  ('a3000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', '이고객', 'a0000000-0000-0000-0000-000000000001');
insert into public.client_projects (client_id, project_id, company_id)
values ('a3000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001');
select throws_ok($$ insert into public.client_projects (client_id, project_id, company_id)
  values ('a3000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001') $$,
  '23505', null, 'TC-021 한 프로젝트를 두 고객 카드에 연결할 수 없다');
select throws_ok($$ insert into public.client_projects (client_id, project_id, company_id)
  values ('a3000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001') $$,
  'P0001', 'scope_mismatch', 'TC-021 다른 업체 프로젝트는 연결할 수 없다');

select * from finish();
rollback;

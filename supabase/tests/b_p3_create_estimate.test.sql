-- b_p3_create_estimate.test.sql
-- B 디자이너 페이지 D-05 — create_estimate RPC 원자성·권한 (20261024000200)
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
-- D-37: 견적 PDF 는 견적을 올리는 업체관리자(owner1)가 업로드한 파일로 둔다
-- (업로더는 불변 칸이라 시드 보정 동안만 트리거를 끈다 — 트랜잭션 끝에서 되돌아감)
alter table public.files disable trigger user;
update public.files set uploaded_by = 'a0000000-0000-0000-0000-000000000001'
 where id in ('f0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000005');
alter table public.files enable trigger user;

set local role authenticated;

-- D-37 · CR-9: 담당자 pm1 은 편집자여도 견적을 만들 수 없다 (보기만)
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$ select public.create_estimate('e1000000-0000-0000-0000-000000000009', 'e2000000-0000-0000-0000-000000000009',
    'b0000000-0000-0000-0000-000000000001', '담당자 견적', 'v1', '담당자', 'f0000000-0000-0000-0000-000000000004', false) $$,
  '42501', NULL, 'D-37 담당자는 견적 생성 불가 (RLS)');

-- 정상: 업체관리자(소유자 owner1) → 견적 + 1번 버전 한 번에
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is(
  public.create_estimate('e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001', '1차 견적', 'v1', '최초 견적', 'f0000000-0000-0000-0000-000000000004', false),
  1, 'D-05 편집자: 견적 생성 → 첫 버전 번호 1');
select is((select count(*)::int from public.estimate_versions where estimate_id = 'e1000000-0000-0000-0000-000000000001'), 1,
  'D-05 견적과 첫 버전이 함께 저장됨');
select is((select created_by from public.estimates where id = 'e1000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-000000000001'::uuid, 'D-05 created_by 는 호출자로 강제');

-- D-37: 담당자는 만든 견적을 볼 수는 있지만 고치거나 새 버전을 올릴 수 없다
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from public.estimates where id = 'e1000000-0000-0000-0000-000000000001'), 1,
  'D-37 담당자는 견적을 본다');
update public.estimates set title = '담당자 수정' where id = 'e1000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select title from public.estimates where id = 'e1000000-0000-0000-0000-000000000001'), '1차 견적',
  'D-37 담당자의 견적 수정은 반영되지 않는다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$ insert into public.estimate_versions (estimate_id, project_id, company_id, version_label, file_id, change_note, uploaded_by)
  values ('e1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
          'v2', 'f0000000-0000-0000-0000-000000000005', '담당자 버전', 'a0000000-0000-0000-0000-000000000002') $$,
  '42501', NULL, 'D-37 담당자는 새 버전을 올릴 수 없다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- 예외: 버전 저장 실패(다른 업체 파일) → 견적도 남지 않음
select throws_ok($$ select public.create_estimate('e1000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000001', '실패 견적', 'v1', '파일 오류', 'f0000000-0000-0000-0000-000000000009', false) $$,
  NULL, NULL, 'D-05 잘못된 파일이면 실패');
select is((select count(*)::int from public.estimates where id = 'e1000000-0000-0000-0000-000000000002'), 0,
  'D-05 버전 실패 시 견적 묶음도 남지 않음 (원자성)');

-- 예외: 변경 설명 빈 값 → 실패, 견적 없음
select throws_ok($$ select public.create_estimate('e1000000-0000-0000-0000-000000000003', 'e2000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000001', '빈 설명', 'v1', '', 'f0000000-0000-0000-0000-000000000005', false) $$,
  '23514', NULL, 'D-05 변경 설명 CHECK 위반');
select is((select count(*)::int from public.estimates where id = 'e1000000-0000-0000-0000-000000000003'), 0,
  'D-05 CHECK 실패 시 견적 없음');

-- 권한 거부: 고객 cust1 은 견적을 만들 수 없음
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select throws_ok($$ select public.create_estimate('e1000000-0000-0000-0000-000000000004', 'e2000000-0000-0000-0000-000000000004',
    'b0000000-0000-0000-0000-000000000001', '고객 견적', 'v1', '고객', 'f0000000-0000-0000-0000-000000000005', false) $$,
  '42501', NULL, 'D-05 고객은 견적 생성 불가 (RLS)');

-- 권한 거부: 다른 업체 소유자 out1
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
select throws_ok($$ select public.create_estimate('e1000000-0000-0000-0000-000000000005', 'e2000000-0000-0000-0000-000000000005',
    'b0000000-0000-0000-0000-000000000001', '타업체', 'v1', '타업체', 'f0000000-0000-0000-0000-000000000005', false) $$,
  '42501', NULL, 'D-05 다른 업체는 견적 생성 불가 (RLS)');

select * from finish();
rollback;

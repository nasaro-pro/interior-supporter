-- a_home_template.test.sql
-- A 고객 페이지 템플릿 검증 — REQ-052, POL-026, CR-A-10 (20261024000100_a_home_template.sql · 20261025000100_a_page_theme.sql)
-- 실행: npm run db:test (Supabase CLI test db). 트랜잭션 안에서 실행 후 롤백.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;
select * from no_plan();

-- ---- 최소 시드: owner1·pm1 = 업체1 / cust1 = P1 고객 / out1 = 업체2 소유자 ----
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'owner1@test.local', '{"display_name":"소유자1"}'),
  ('a0000000-0000-0000-0000-000000000002', 'pm1@test.local',    '{"display_name":"PM1"}'),
  ('a0000000-0000-0000-0000-000000000004', 'cust1@test.local',  '{"display_name":"고객1"}'),
  ('a0000000-0000-0000-0000-000000000007', 'out1@test.local',   '{"display_name":"타업체"}');
insert into public.companies (id, slug, name, created_by) values
  ('c0000000-0000-0000-0000-000000000001', 'studio-one', '스튜디오 원', 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000002', 'studio-two', '스튜디오 투', 'a0000000-0000-0000-0000-000000000007');
insert into public.company_settings (company_id) values
  ('c0000000-0000-0000-0000-000000000001'), ('c0000000-0000-0000-0000-000000000002');
insert into public.company_members (company_id, user_id, role) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'pm'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000007', 'owner');
insert into public.projects (id, company_id, name, is_public, created_by) values
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '기존 현장', true, 'a0000000-0000-0000-0000-000000000002');
insert into public.project_participants (project_id, company_id, user_id, role, can_confirm) values
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'customer', false);
-- 이미지 후보: e1 = 업체1 company_logo(ready) / e2 = 업체1 company_logo(pending) / e3 = 업체2 company_logo / e4 = 업체1 도면
insert into public.files (id, company_id, project_id, kind, path, original_name, mime, size_bytes, status, uploaded_by) values
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', null, 'company_logo', 'test/background.webp', 'background.webp', 'image/webp', 1000, 'ready',   'a0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', null, 'company_logo', 'test/cover2.webp', 'cover2.webp', 'image/webp', 1000, 'pending', 'a0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', null, 'company_logo', 'test/other.webp', 'other.webp', 'image/webp', 1000, 'ready',   'a0000000-0000-0000-0000-000000000007'),
  ('e0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'design_original', 'test/plan.pdf', 'plan.pdf', 'application/pdf', 1000, 'ready', 'a0000000-0000-0000-0000-000000000002');

-- ===== 기본값 · CHECK =====
select is((select default_home_theme from public.company_settings where company_id = 'c0000000-0000-0000-0000-000000000001'),
  'brand', '업체 템플릿 테마 기본값 = brand');
select is((select home_theme from public.projects where id = 'b0000000-0000-0000-0000-000000000001'),
  'brand', '기존 프로젝트 테마 = brand (기존 동작 유지)');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select throws_ok($$ update public.company_settings set default_home_theme = 'hotpink'
  where company_id = 'c0000000-0000-0000-0000-000000000001' $$,
  '23514', NULL, '토큰 목록 밖 테마는 거절');
select throws_ok($$ update public.company_settings set default_home_sections = '[{"key":"overview","visible":true}]'::jsonb
  where company_id = 'c0000000-0000-0000-0000-000000000001' $$,
  '23514', NULL, '4영역 순열이 아니면 거절');

-- ===== 페이지 이미지 · 분위기 검사 =====
select throws_ok($$ update public.company_settings set default_page_images = '{"designs":"e0000000-0000-0000-0000-000000000003"}'
  where company_id = 'c0000000-0000-0000-0000-000000000001' $$,
  'P0001', 'file_kind_mismatch', '다른 업체 파일은 페이지 이미지로 쓸 수 없다');
select throws_ok($$ update public.company_settings set default_page_images = '{"home":"e0000000-0000-0000-0000-000000000002"}'
  where company_id = 'c0000000-0000-0000-0000-000000000001' $$,
  'P0001', 'file_kind_mismatch', 'ready 가 아닌 파일은 페이지 이미지로 쓸 수 없다');
select throws_ok($$ update public.company_settings set default_page_images = '{"home":"e0000000-0000-0000-0000-000000000004"}'
  where company_id = 'c0000000-0000-0000-0000-000000000001' $$,
  'P0001', 'file_kind_mismatch', 'company_logo 가 아닌 파일은 페이지 이미지로 쓸 수 없다');
select throws_ok($$ update public.company_settings set default_page_images = '{"overview":"e0000000-0000-0000-0000-000000000001"}'
  where company_id = 'c0000000-0000-0000-0000-000000000001' $$,
  '23514', NULL, '고객 포털 탭이 아닌 키는 거절');
select throws_ok($$ update public.company_settings set default_page_images = '{"home":"not-a-uuid"}'
  where company_id = 'c0000000-0000-0000-0000-000000000001' $$,
  '23514', NULL, 'uuid 가 아닌 값은 거절');
select throws_ok($$ update public.company_settings set default_page_tone = 'hotpink'
  where company_id = 'c0000000-0000-0000-0000-000000000001' $$,
  '23514', NULL, '프리셋 밖 분위기는 거절');

-- ===== owner 가 템플릿 저장 =====
select lives_ok($$ update public.company_settings set
    default_home_message = '템플릿 안내문',
    default_home_theme = 'info',
    default_page_images = '{"home":"e0000000-0000-0000-0000-000000000001","photos":"e0000000-0000-0000-0000-000000000001"}',
    default_page_tone = 'sage',
    default_home_sections = '[{"key":"schedule","visible":true},{"key":"overview","visible":true},{"key":"recent","visible":false},{"key":"documents","visible":true}]'::jsonb
  where company_id = 'c0000000-0000-0000-0000-000000000001' $$, 'owner 는 템플릿 전체 저장 가능');

-- ===== 권한 거부: pm 은 템플릿 수정 불가 (RLS → 0행) =====
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
update public.company_settings set default_home_theme = 'neutral' where company_id = 'c0000000-0000-0000-0000-000000000001';
reset role;
select is((select default_home_theme from public.company_settings where company_id = 'c0000000-0000-0000-0000-000000000001'),
  'info', 'pm 의 템플릿 수정은 반영되지 않는다 (POL-030)');
set local role authenticated;

-- ===== 신규 프로젝트에 템플릿 복사 (pm 생성) =====
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
insert into public.projects (id, company_id, name, created_by) values
  ('b0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000001', '새 현장', 'a0000000-0000-0000-0000-000000000002');
select is((select home_message from public.projects where id = 'b0000000-0000-0000-0000-000000000010'), '템플릿 안내문', '신규: 안내문 복사');
select is((select home_theme from public.projects where id = 'b0000000-0000-0000-0000-000000000010'), 'info', '신규: 테마 복사');
select is((select page_images ->> 'photos' from public.projects where id = 'b0000000-0000-0000-0000-000000000010'),
  'e0000000-0000-0000-0000-000000000001', '신규: 페이지 이미지 복사');
select is((select page_tone from public.projects where id = 'b0000000-0000-0000-0000-000000000010'), 'sage', '신규: 분위기 복사');
select is((select home_sections -> 0 ->> 'key' from public.projects where id = 'b0000000-0000-0000-0000-000000000010'),
  'schedule', '신규: 4영역 순서 복사');
select is((select home_sections -> 2 ->> 'visible' from public.projects where id = 'b0000000-0000-0000-0000-000000000010'),
  'false', '신규: 4영역 표시 여부 복사');

-- 직접 지정한 값은 템플릿보다 우선
insert into public.projects (id, company_id, name, home_theme, home_message, created_by) values
  ('b0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000001', '지정 현장', 'caution', '직접 쓴 안내문', 'a0000000-0000-0000-0000-000000000002');
select is((select home_theme from public.projects where id = 'b0000000-0000-0000-0000-000000000011'), 'caution', '지정한 테마는 유지');
select is((select home_message from public.projects where id = 'b0000000-0000-0000-0000-000000000011'), '직접 쓴 안내문', '지정한 안내문은 유지');

-- 이미 만든 프로젝트에는 적용되지 않는다
select is((select home_theme from public.projects where id = 'b0000000-0000-0000-0000-000000000001'), 'brand', '기존 프로젝트는 그대로');
select is((select page_images from public.projects where id = 'b0000000-0000-0000-0000-000000000001'), '{}'::jsonb, '기존 프로젝트 페이지 이미지도 그대로');
select is((select page_tone from public.projects where id = 'b0000000-0000-0000-0000-000000000001'), 'default', '기존 프로젝트 분위기도 그대로');

-- 프로젝트 페이지 이미지에 다른 업체 파일 지정 거절
select throws_ok($$ update public.projects set page_images = '{"home":"e0000000-0000-0000-0000-000000000003"}'
  where id = 'b0000000-0000-0000-0000-000000000010' $$,
  'P0001', 'file_kind_mismatch', '프로젝트 페이지 이미지도 같은 업체 파일만');
select lives_ok($$ update public.projects set page_images = '{"photos":"e0000000-0000-0000-0000-000000000001"}', page_tone = 'clay', home_theme = 'neutral'
  where id = 'b0000000-0000-0000-0000-000000000010' $$, '편집자는 페이지 이미지 제거·분위기·테마 변경 가능');

-- ===== 고객: 페이지 이미지 파일 열람 가능, 타 업체 고객은 불가 =====
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select is((select count(*)::int from public.files where id = 'e0000000-0000-0000-0000-000000000001'), 1, '참여 고객은 업체 페이지 이미지 파일을 볼 수 있다');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
select is((select count(*)::int from public.files where id = 'e0000000-0000-0000-0000-000000000001'), 0, '타 업체 사용자는 페이지 이미지 파일을 볼 수 없다');
select is((select count(*)::int from public.company_settings where company_id = 'c0000000-0000-0000-0000-000000000001'), 0, '타 업체 사용자는 템플릿을 볼 수 없다');
reset role;

select * from finish();
rollback;

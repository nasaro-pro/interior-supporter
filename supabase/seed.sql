-- =====================================================================
-- supabase/seed.sql (A · TASK-011) — 개발 전용 공통 테스트 데이터 (00 헌법 부록 C, 평가서 05장)
-- !! 운영(prod) DB 에는 절대 적용하지 않는다 — 개발·통합 dev 프로젝트 전용 !!
--    가드: app.seed_password 가 설정되지 않으면 계정 단계에서 예외로 중단된다 (실수 적용 방지).
-- 적용(dev 전용): 같은 트랜잭션/세션에서 먼저 비밀번호를 주입한 뒤 이 파일을 실행
--   select set_config('app.seed_password', '<개발용 비밀번호>', false);
--   · 통합 도구: node _integration/tools/apply-seed.mjs (20_merged/.env.local 의 SEED_PASSWORD 를 주입)
--   · E2E: E2E_SEED_PASSWORD 환경변수에 같은 값
-- 비밀번호 값은 이 파일·주석·로그에 적지 않는다 (A-13)
-- 여러 번 실행해도 같은 결과 (고정 id + on conflict do nothing)
--
-- 계정 (모두 같은 개발용 비밀번호 — 실제 개인정보 아님, example.test 도메인)
--   OX  owner-x@example.test   업체 X(studio-x) 소유자
--   PM1 pm1@example.test       X 구성원(pm), P1 배정
--   PM2 pm2@example.test       X 구성원(pm), P2 전용 (P1 미배정)
--   U1  cust1@example.test     P1 고객(확정권)
--   U2  cust2@example.test     P1 고객(확정권 없음)
--   U3  cust3@example.test     미초대 고객 (어떤 프로젝트에도 참여 없음)
--   F1  field1@example.test    P1 시공팀 유효 배정
--   F2  field2@example.test    P1 시공팀 기간 만료 배정
--   OY  owner-y@example.test   업체 Y(studio-y) 소유자
--   F3  field3@example.test    P1·P2 시공팀 (여러 현장, C-T05)
--   F4  field4@example.test    P1 시공팀 배정 회수됨(revoked_at, C-T06)
-- 프로젝트: P1(X, 공개) · P2(X, 비공개) · Q1(Y, 공개)
-- B·C 영역 자료(도안·자재·견적·요청·사진·일정)는 각 담당의 seed 범위 — 병합 후 이 파일로 통일 (TASK-900)
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ── 1. 계정 (auth.users + auth.identities) — handle_new_user 트리거가 profiles 생성 ──────────
do $$
declare
  u record;
  v_pw text := nullif(current_setting('app.seed_password', true), '');
  pw text;
begin
  -- A-13: 비밀번호는 실행 시 주입 (평문을 파일에 두지 않음). 미설정이면 중단 = 운영 DB 실수 적용 가드
  if v_pw is null then
    raise exception 'seed.sql: app.seed_password 미설정 — dev DB 에서만, 비밀번호를 주입한 뒤 실행하세요 (운영 적용 금지)';
  end if;
  pw := extensions.crypt(v_pw, extensions.gen_salt('bf'));
  for u in
    select * from (values
      ('00000000-0000-4000-a000-000000000001'::uuid, 'owner-x@example.test', '김소유'),
      ('00000000-0000-4000-a000-000000000002'::uuid, 'pm1@example.test',     '이피엠'),
      ('00000000-0000-4000-a000-000000000003'::uuid, 'pm2@example.test',     '박피엠'),
      ('00000000-0000-4000-a000-000000000004'::uuid, 'cust1@example.test',   '최고객'),
      ('00000000-0000-4000-a000-000000000005'::uuid, 'cust2@example.test',   '정고객'),
      ('00000000-0000-4000-a000-000000000006'::uuid, 'cust3@example.test',   '한미초대'),
      ('00000000-0000-4000-a000-000000000007'::uuid, 'field1@example.test',  '오시공'),
      ('00000000-0000-4000-a000-000000000008'::uuid, 'field2@example.test',  '윤만료'),
      ('00000000-0000-4000-a000-000000000009'::uuid, 'owner-y@example.test', '강타업체'),
      ('00000000-0000-4000-a000-00000000000a'::uuid, 'field3@example.test',  '서다현장'),
      ('00000000-0000-4000-a000-00000000000b'::uuid, 'field4@example.test',  '문회수')
    ) as t(id, email, name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, pw, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', u.name, 'locale', 'ko'),
      now(), now(), '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now())
    on conflict do nothing;
  end loop;
end $$;

-- ── 2. 업체 X·Y (RPC: 업체 + 설정 + owner) ─────────────────────────────────
do $$
begin
  if not exists (select 1 from public.companies where slug = 'studio-x') then
    perform public.create_company_with_owner('00000000-0000-4000-a000-000000000001', '스튜디오 엑스', 'studio-x', '김소유');
  end if;
  if not exists (select 1 from public.companies where slug = 'studio-y') then
    perform public.create_company_with_owner('00000000-0000-4000-a000-000000000009', '와이 인테리어', 'studio-y', '강타업체');
  end if;
end $$;

update public.company_settings s
   set default_home_message = '안녕하세요. 공사 진행 상황과 자료를 이곳에서 확인하실 수 있습니다. 궁금한 점은 요청 탭에 남겨 주세요.'
  from public.companies c
 where c.id = s.company_id and c.slug = 'studio-x' and s.default_home_message = '';

-- ── 3. 구성원 PM1·PM2 (구성원 추가는 RPC/시스템 문맥 전용) ───────────────────
do $$
declare v_x uuid := (select id from public.companies where slug = 'studio-x');
begin
  perform set_config('app.system_write', 'on', true);
  insert into public.company_members (company_id, user_id, role) values
    (v_x, '00000000-0000-4000-a000-000000000002', 'pm'),
    (v_x, '00000000-0000-4000-a000-000000000003', 'pm')
  on conflict (company_id, user_id) do nothing;
  perform set_config('app.system_write', 'off', true);
end $$;

-- ── 4. 프로젝트 P1·P2·Q1 (생성자 = 소유자 → 트리거가 pm 자동 배정·안내문 템플릿 적용) ─────────
insert into public.projects (id, company_id, name, site_address, start_date, end_date, status, current_phase, is_public, created_by)
select '00000000-0000-4000-b000-000000000001', c.id, '반포 래미안 32평 리모델링', '서울 서초구 반포동 (예시 주소)',
       '2026-10-01', '2026-12-20', 'active', '목공', true, '00000000-0000-4000-a000-000000000001'
  from public.companies c where c.slug = 'studio-x'
on conflict (id) do nothing;

insert into public.projects (id, company_id, name, site_address, start_date, end_date, status, current_phase, is_public, created_by)
select '00000000-0000-4000-b000-000000000002', c.id, '분당 오피스텔 부분 시공', '경기 성남시 분당구 (예시 주소)',
       '2026-11-01', null, 'planned', '', false, '00000000-0000-4000-a000-000000000001'
  from public.companies c where c.slug = 'studio-x'
on conflict (id) do nothing;

insert into public.projects (id, company_id, name, site_address, start_date, end_date, status, current_phase, is_public, created_by)
select '00000000-0000-4000-b000-000000000003', c.id, '타 업체 프로젝트 Q1', '부산 해운대구 (예시 주소)',
       '2026-09-01', '2026-11-30', 'active', '도장', true, '00000000-0000-4000-a000-000000000009'
  from public.companies c where c.slug = 'studio-y'
on conflict (id) do nothing;

-- ── 5. 참여자 (PM1→P1, PM2→P2, U1·U2 고객, F1 유효·F2 만료) ─────────────────────
insert into public.project_participants (company_id, project_id, user_id, role, can_confirm, valid_from, valid_until, invited_by)
select p.company_id, p.id, v.user_id::uuid, v.role::public.participant_role, v.can_confirm, v.valid_from::date, v.valid_until::date,
       '00000000-0000-4000-a000-000000000001'
  from (values
    ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000002', 'pm',       false, null,         null),
    ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000003', 'pm',       false, null,         null),
    ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000004', 'customer', true,  null,         null),
    ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000005', 'customer', false, null,         null),
    ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000007', 'field',    false, '2026-10-01', '2026-12-31'),
    ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000008', 'field',    false, '2026-01-01', '2026-01-31')
  ) as v(project_id, user_id, role, can_confirm, valid_from, valid_until)
  join public.projects p on p.id = v.project_id::uuid
on conflict (project_id, user_id, role) do nothing;

-- ── 5-1. 시공팀 보강 (E2E C-T05 여러 현장 · C-T06 회수) ──────────────────────────────
-- F3: P1·P2 둘 다 유효(기간 없음). F4: P1 배정 후 회수(revoked_at) — 회수된 시공팀은 접근 불가 확인용
insert into public.project_participants (company_id, project_id, user_id, role, can_confirm, valid_from, valid_until, invited_by, revoked_at)
select p.company_id, p.id, v.user_id::uuid, 'field'::public.participant_role, false, null, null,
       '00000000-0000-4000-a000-000000000001', v.revoked_at::timestamptz
  from (values
    ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-00000000000a', null),
    ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-00000000000a', null),
    ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-00000000000b', '2026-10-05T09:00:00+09:00')
  ) as v(project_id, user_id, revoked_at)
  join public.projects p on p.id = v.project_id::uuid
on conflict (project_id, user_id, role) do nothing;

-- F4 가 이미 (회수 없이) 있었다면 회수 상태로 맞춘다 (재실행 안전)
update public.project_participants
   set revoked_at = '2026-10-05T09:00:00+09:00'
 where project_id = '00000000-0000-4000-b000-000000000001'
   and user_id = '00000000-0000-4000-a000-00000000000b'
   and role = 'field'
   and revoked_at is null;

-- ── 6. 고객 카드 (P1 ↔ 고객 카드 1개, D03) ───────────────────────────────────
insert into public.clients (id, company_id, name, phone, email, memo, user_id, created_by)
select '00000000-0000-4000-c000-000000000001', c.id, '최고객', '010-0000-0001', 'cust1@example.test',
       '평일 오후 연락 선호 (예시 메모)', '00000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-000000000001'
  from public.companies c where c.slug = 'studio-x'
on conflict (id) do nothing;

insert into public.client_projects (company_id, client_id, project_id)
select c.company_id, c.id, '00000000-0000-4000-b000-000000000001'
  from public.clients c where c.id = '00000000-0000-4000-c000-000000000001'
on conflict do nothing;

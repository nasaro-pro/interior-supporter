-- =====================================================================
-- 20261116000100_a_customer_home_style.sql
-- 소유: A · 관련: REQ-014 · REQ-052 (고객 홈 꾸미기), 2026-11 고객 화면 새 디자인
-- 내용:
--   1) projects: 고객 화면 제목 글꼴(title_font) · 굵기(title_weight) — 공개 홈페이지와 같은 선택지
--   2) 고객 홈 칸 기본 순서: 진행 → 도안(documents) → 최근 현장 사진(recent) → 다음 일정
--      (기본 순서 그대로인 프로젝트·업체 템플릿만 새 순서로. 직접 바꾼 순서는 그대로 둔다)
--   3) 신규 프로젝트 템플릿 복사 트리거(project_defaults)의 '기본값' 비교를 새 순서로
-- 롤백: 새 컬럼은 기본값이 있어 앱을 되돌려도 동작 유지. 순서는 사용자가 꾸미기 화면에서 다시 바꿀 수 있다
-- =====================================================================

alter table public.projects
  add column title_font text not null default 'noto_sans',
  add column title_weight smallint not null default 600,
  add constraint projects_title_font_valid check (title_font in ('noto_sans', 'noto_serif')),
  add constraint projects_title_weight_valid check (title_weight in (400, 500, 600));

-- 2) 기본 순서 바꾸기
update public.projects
   set home_sections = '[{"key":"overview","visible":true},{"key":"documents","visible":true},{"key":"recent","visible":true},{"key":"schedule","visible":true}]'::jsonb
 where home_sections = '[{"key":"overview","visible":true},{"key":"recent","visible":true},{"key":"schedule","visible":true},{"key":"documents","visible":true}]'::jsonb;

update public.company_settings
   set default_home_sections = '[{"key":"overview","visible":true},{"key":"documents","visible":true},{"key":"recent","visible":true},{"key":"schedule","visible":true}]'::jsonb
 where default_home_sections = '[{"key":"overview","visible":true},{"key":"recent","visible":true},{"key":"schedule","visible":true},{"key":"documents","visible":true}]'::jsonb;

alter table public.projects
  alter column home_sections set default
    '[{"key":"overview","visible":true},{"key":"documents","visible":true},{"key":"recent","visible":true},{"key":"schedule","visible":true}]'::jsonb;
alter table public.company_settings
  alter column default_home_sections set default
    '[{"key":"overview","visible":true},{"key":"documents","visible":true},{"key":"recent","visible":true},{"key":"schedule","visible":true}]'::jsonb;

-- 3) 20261025000100_a_page_theme 의 project_defaults 와 같고, home_sections 기본값 비교만 새 순서로
create or replace function private.project_defaults() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s public.company_settings;
begin
  select * into s from public.company_settings where company_id = new.company_id;
  if coalesce(new.home_message, '') = '' then
    new.home_message := coalesce(s.default_home_message, '');
  end if;
  if s.company_id is not null then
    -- 컬럼 기본값 그대로일 때만 템플릿으로 (호출자가 직접 지정한 값은 존중)
    if new.home_sections = '[{"key":"overview","visible":true},{"key":"documents","visible":true},{"key":"recent","visible":true},{"key":"schedule","visible":true}]'::jsonb then
      new.home_sections := s.default_home_sections;
    end if;
    if new.home_theme = 'brand' then
      new.home_theme := s.default_home_theme;
    end if;
    if new.page_images = '{}'::jsonb then
      new.page_images := s.default_page_images;
    end if;
    if new.page_tone = 'default' then
      new.page_tone := s.default_page_tone;
    end if;
  end if;
  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end $$;

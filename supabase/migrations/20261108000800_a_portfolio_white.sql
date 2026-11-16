-- =====================================================================
-- 20261108000800_a_portfolio_white.sql
-- 소유: A · 포트폴리오 분위기: 기본 = 화이트, 예전 기본(Stitch 종이색 #F5F1E9)은 '종이색'(paper)으로 추가
--  공용 목록(private.valid_page_tone · 고객 홈 템플릿)은 그대로 두고 포트폴리오 칸만 따로 검사한다
--  'default' 의 뜻: 공용에서는 앱 바탕색(흰색) → 포트폴리오도 흰색으로 맞춤
-- =====================================================================

alter table public.company_portfolios drop constraint company_portfolios_page_tone_check;
alter table public.company_portfolios
  add constraint company_portfolios_page_tone_check
    check (page_tone in ('default', 'paper', 'ivory', 'sand', 'greige', 'sage', 'mist', 'clay')),
  alter column page_tone set default 'default';

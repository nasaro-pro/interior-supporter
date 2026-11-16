-- 20261108001000_a_portfolio_noto_default.sql (A · CR-PF-21)
-- 공개 홈페이지 기본 글꼴을 제목·본문 모두 '노토 산스 KR'로 바꾼다 (사용자 결정 2026-11-11)
--   이전 기본: 제목 serif(노토 세리프) · 본문 pretendard
--   새 기본  : 제목 noto_sans · 본문 noto_sans
-- 기본값만 바꾼다. 이미 저장된 업체 설정(업체가 고른 값)은 건드리지 않는다.
alter table public.company_portfolios
  alter column title_font set default 'noto_sans',
  alter column body_font set default 'noto_sans';

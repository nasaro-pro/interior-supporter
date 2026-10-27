-- =====================================================================
-- 20261024000400_c_schedule_progress.sql
-- 소유: C · 디자이너 페이지 D-30 (고객 페이지 CU-09 와 짝) — CR-7
-- 일정 진행 상태: planned(예정) · in_progress(진행중) · done(완료). 편집자가 정하고 고객은 공개 일정에서 본다.
-- 쓰기 권한은 기존 schedule_events 정책(편집자만)을 그대로 따른다.
-- =====================================================================

alter table public.schedule_events
  add column progress text not null default 'planned'
  check (progress in ('planned', 'in_progress', 'done'));

-- =====================================================================
-- 20261013000210_b_created_by_defaults.sql
-- 소유: B (류영걸) · 파트 2 · 결함 DB-04 (일반)
-- estimates·design_previews 의 created_by 를 트리거가 auth.uid() 로 강제 (A 의 private.set_created_by 사용 → A 마이그레이션 다음 순서).
-- 앱이 값을 보내도 덮어쓰므로 위조 불가, 빠뜨려도 23502 가 나지 않는다.
-- =====================================================================

create trigger a_created_by before insert on public.estimates
  for each row execute function private.set_created_by();
create trigger a_created_by before insert on public.design_previews
  for each row execute function private.set_created_by();

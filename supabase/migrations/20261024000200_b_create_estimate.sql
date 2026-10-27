-- =====================================================================
-- 20261024000200_b_create_estimate.sql
-- 소유: B · 디자이너 페이지 D-05 (CR-B-01)
-- 견적 묶음 + 첫 버전을 한 트랜잭션으로 만든다. 버전 저장이 실패하면 견적도 남지 않는다.
-- security invoker: 호출자 권한으로 실행 → 기존 RLS(estimates_insert·estimate_versions_insert)와
-- 트리거(scope·created_by·a_number·attach·notify·audit)가 그대로 적용된다.
-- =====================================================================

create function public.create_estimate(
  p_id uuid,
  p_version_id uuid,
  p_project uuid,
  p_title text,
  p_version_label text,
  p_change_note text,
  p_file uuid,
  p_is_public boolean
) returns integer
language plpgsql security invoker set search_path = '' as $$
declare v_no integer;
begin
  -- company_id·created_by·uploaded_by 는 트리거가 덮어쓴다 (NOT NULL 이라 자리값을 넣는다)
  insert into public.estimates (id, company_id, project_id, title, created_by)
  values (p_id, '00000000-0000-0000-0000-000000000000', p_project, p_title, auth.uid());

  insert into public.estimate_versions
    (id, company_id, project_id, estimate_id, version_no, version_label, change_note, file_id, is_public, uploaded_by)
  values
    (p_version_id, '00000000-0000-0000-0000-000000000000', p_project, p_id, 0,
     p_version_label, p_change_note, p_file, coalesce(p_is_public, false), auth.uid())
  returning version_no into v_no;

  return v_no;
end $$;

revoke all on function public.create_estimate(uuid, uuid, uuid, text, text, text, uuid, boolean) from public, anon;
grant execute on function public.create_estimate(uuid, uuid, uuid, text, text, text, uuid, boolean) to authenticated;

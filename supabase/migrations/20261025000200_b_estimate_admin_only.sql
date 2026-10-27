-- =====================================================================
-- 20261025000200_b_estimate_admin_only.sql
-- 소유: B · 디자이너 페이지 D-37 (업체관리자 CA-09) — CR-9
-- 견적서 등록 · 새 버전 · 공개 · 보관은 업체관리자(owner · manager)만. 담당자(pm)는 보기만.
-- 조회 정책(row_visible_*)은 그대로 — 담당자 · 고객이 보는 범위는 바뀌지 않는다.
-- create_estimate RPC 는 security invoker 라 아래 정책이 그대로 적용된다.
-- =====================================================================

create function private.can_manage_estimates(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project
      and private.is_company_manager(p.company_id)
  )
$$;

drop policy estimates_insert on public.estimates;
drop policy estimates_update on public.estimates;
drop policy estimate_versions_insert on public.estimate_versions;
drop policy estimate_versions_update on public.estimate_versions;

create policy estimates_insert on public.estimates for insert to authenticated
  with check (private.can_manage_estimates(project_id) and created_by = (select auth.uid()));
create policy estimates_update on public.estimates for update to authenticated
  using (private.can_manage_estimates(project_id)) with check (private.can_manage_estimates(project_id));
create policy estimate_versions_insert on public.estimate_versions for insert to authenticated
  with check (private.can_manage_estimates((select e.project_id from public.estimates e where e.id = estimate_id)));
create policy estimate_versions_update on public.estimate_versions for update to authenticated
  using (private.can_manage_estimates(project_id)) with check (private.can_manage_estimates(project_id));

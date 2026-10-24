-- =====================================================================
-- 20261013000100_a_password_reset_scope.sql
-- 소유: A (박예원) · 파트 2 · 결함 SEC-01 (치명) · CR-INT-02 (통합 책임자 잠정 승인)
-- 문제: 베이스라인 can_issue_password_reset 은 "대상이 이 업체의 owner 가 아니고, 구성원이거나 (회수·기간 무관) 참여자"
--       이면 true → 다른 업체 owner 가 이 업체 프로젝트에 고객으로 참여만 해도 재설정 링크 발급 → 계정 탈취.
-- 수정: 대상은 (1) 이 업체의 owner 아닌 현재 구성원 이면서 다른 업체 구성원이 아니거나,
--       (2) 어떤 업체 구성원도 아니고, 이 업체에만 참여 이력이 있으며 회수되지 않은 참여가 있는 사용자.
-- 결정: 다른 업체에도 참여 중인 고객·시공팀은 제외(보수적). 그런 사용자는 본인이 받은 초대·로그인으로 해결.
-- =====================================================================

create or replace function public.can_issue_password_reset(p_actor uuid, p_company uuid, p_target uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_company_manager_for(p_actor, p_company)
     and p_actor <> p_target
     -- 어떤 업체의 owner 도, 다른 업체의 구성원도 대상이 아니다
     and not exists (
       select 1 from public.company_members m
       where m.user_id = p_target and m.removed_at is null
         and (m.role = 'owner' or m.company_id <> p_company))
     and (
       -- (1) 이 업체의 현재 구성원 (owner 제외 — 위에서 걸러짐)
       exists (
         select 1 from public.company_members m
         where m.user_id = p_target and m.company_id = p_company and m.removed_at is null)
       -- (2) 구성원이 아닌 참여자: 이 업체에 회수되지 않은 참여가 있고, 다른 업체 참여 이력이 없음
       or (
         exists (
           select 1 from public.project_participants pp
           where pp.company_id = p_company and pp.user_id = p_target and pp.revoked_at is null)
         and not exists (
           select 1 from public.project_participants o
           where o.user_id = p_target and o.company_id <> p_company)
         and not exists (
           select 1 from public.company_members m2
           where m2.user_id = p_target and m2.removed_at is null))
     )
$$;

-- create or replace 는 기존 권한을 유지하지만, 명시적으로 다시 고정한다 (service_role 전용)
revoke execute on function public.can_issue_password_reset(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.can_issue_password_reset(uuid, uuid, uuid) to service_role;

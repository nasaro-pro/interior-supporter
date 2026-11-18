-- =====================================================================
-- 20261118000100_a_admin_grant.sql
-- 소유: 사이트 관리 파트 · 2026-11 사용자 요청: 사이트 관리자 권한을 화면(계정 관리 ADM-04)에서 부여·해제
-- (20261026000100 의 "화면에서 추가하지 않는다"를 바꾼다)
--   · 관리자만 호출. 본인은 대상이 될 수 없다 → 부르는 관리자가 늘 남으므로 관리자가 0명이 되지 않는다
--   · 익명화·정지된 계정에는 부여하지 않는다
--   · 관리 기록(admin_audit_events)에 admin_granted / admin_revoked 로 남긴다
-- =====================================================================

alter table public.admin_audit_events drop constraint admin_audit_events_action_check;
alter table public.admin_audit_events add constraint admin_audit_events_action_check check (action in (
  'company_owner_changed', 'user_suspended', 'user_unsuspended', 'user_anonymized',
  'self_withdrawn', 'site_settings_updated', 'company_quota_updated',
  'files_purged', 'notifications_purged', 'password_reset_issued',
  'portfolio_site_name_changed', 'portfolio_business_locked', 'portfolio_business_unlocked',
  'admin_granted', 'admin_revoked'));

create function public.admin_set_platform_admin(p_user uuid, p_admin boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_profile record;
begin
  perform private.require_platform_admin();
  if p_user = (select auth.uid()) then
    raise exception 'self_target' using errcode = 'P0001';
  end if;
  select suspended_at, anonymized_at into v_profile from public.profiles where id = p_user;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_admin then
    if v_profile.anonymized_at is not null or v_profile.suspended_at is not null then
      raise exception 'inactive_target' using errcode = 'P0001';
    end if;
    insert into public.platform_admins (user_id) values (p_user) on conflict (user_id) do nothing;
    if not found then return; end if; -- 이미 관리자: 기록 없이 그대로
    perform private.admin_log('admin_granted', 'user', p_user);
  else
    delete from public.platform_admins where user_id = p_user;
    if not found then return; end if; -- 이미 관리자 아님
    perform private.admin_log('admin_revoked', 'user', p_user);
  end if;
end $$;

revoke all on function public.admin_set_platform_admin(uuid, boolean) from public, anon;
grant execute on function public.admin_set_platform_admin(uuid, boolean) to authenticated;

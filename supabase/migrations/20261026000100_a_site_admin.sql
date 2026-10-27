-- =====================================================================
-- 20261026000100_a_site_admin.sql
-- 소유: 사이트 관리 파트 (feature/site-admin) · 통합본 3장 A1~A10 · CR-3
-- 내용
--   1) 사이트 관리자 판별 (A1): platform_admins 표에 등록된 계정만. 화면에서 추가하지 않는다
--   2) 사이트 설정 (A6): 업로드 한도 단일 행 + 업체별 저장공간 한도
--   3) 관리 기록 (A8): admin_audit_events (추가 전용, 관리자만 조회)
--   4) 계정 상태 (A5·A10): profiles.suspended_at · anonymized_at
--   5) 운영 조회·처리 RPC (A3·A4·A5·A7): 모두 SECURITY DEFINER + 관리자 확인
--   6) 본인 탈퇴 (A10): withdraw_me — 업체의 유일한 소유자는 소유자 변경 후에만
-- 삭제 금지(POL-020) 예외는 A7 두 가지(읽은 알림 90일, 연결 안 된·거부 파일)만이다.
-- 업체 승인·반려·정지 상태는 업체관리자 파트 마이그레이션(CR-10)이 만든다. 이 파일은 그 열에 의존하지 않는다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 사이트 관리자 판별
-- ---------------------------------------------------------------------
create table public.platform_admins (
  user_id     uuid primary key references auth.users(id),
  created_at  timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
-- 본인 행만 보인다 (관리자 여부 확인용). 추가·변경은 DB 에서만
create policy platform_admins_select on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

create function private.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()))
$$;

-- 앱 화면 가드용 (/admin 레이아웃)
create function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_platform_admin()
$$;

-- 관리자 전용 RPC 공통 검사
create function private.require_platform_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. 사이트 설정 (A6)
-- ---------------------------------------------------------------------
create table public.site_settings (
  id                    boolean primary key default true check (id),
  photo_max_bytes       bigint  not null default 20971520 check (photo_max_bytes between 1048576 and 104857600),
  photo_batch_max       integer not null default 20 check (photo_batch_max between 1 and 100),
  design_max_bytes      bigint  not null default 52428800 check (design_max_bytes between 1048576 and 524288000),
  default_quota_bytes   bigint check (default_quota_bytes is null or default_quota_bytes >= 104857600),
  updated_at            timestamptz not null default now(),
  updated_by            uuid references auth.users(id)
);
insert into public.site_settings (id) values (true);
alter table public.site_settings enable row level security;
-- 업로드 화면이 한도를 읽는다. 변경은 RPC 로만
create policy site_settings_select on public.site_settings for select to authenticated using (true);

create table public.company_quotas (
  company_id   uuid primary key references public.companies(id),
  quota_bytes  bigint check (quota_bytes is null or quota_bytes >= 104857600),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id)
);
alter table public.company_quotas enable row level security;
create policy company_quotas_select on public.company_quotas for select to authenticated
  using (private.is_platform_admin() or private.is_company_manager(company_id));

-- 업체의 실제 한도 = 업체별 값 → 없으면 사이트 기본값 → 없으면 무제한(null)
create function private.company_quota_bytes(p_company uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select q.quota_bytes from public.company_quotas q where q.company_id = p_company),
    (select s.default_quota_bytes from public.site_settings s where s.id))
$$;

-- ---------------------------------------------------------------------
-- 3. 관리 기록 (A8)
-- ---------------------------------------------------------------------
create table public.admin_audit_events (
  id           bigint generated always as identity primary key,
  actor_id     uuid references auth.users(id),
  action       text not null check (action in (
                 'company_owner_changed', 'user_suspended', 'user_unsuspended', 'user_anonymized',
                 'self_withdrawn', 'site_settings_updated', 'company_quota_updated',
                 'files_purged', 'notifications_purged', 'password_reset_issued')),
  target_type  text not null check (target_type in ('company', 'user', 'site', 'file', 'notification')),
  target_id    uuid,
  detail       jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now()
);
create index admin_audit_events_time_idx on public.admin_audit_events (occurred_at desc);
alter table public.admin_audit_events enable row level security;
create policy admin_audit_events_select on public.admin_audit_events for select to authenticated
  using (private.is_platform_admin());

create function private.admin_log(p_action text, p_target_type text, p_target uuid, p_detail jsonb default '{}'::jsonb)
returns void
language sql security definer set search_path = '' as $$
  insert into public.admin_audit_events (actor_id, action, target_type, target_id, detail)
  values ((select auth.uid()), p_action, p_target_type, p_target, coalesce(p_detail, '{}'::jsonb))
$$;

-- ---------------------------------------------------------------------
-- 4. 계정 상태 (A5·A10)
-- ---------------------------------------------------------------------
alter table public.profiles
  add column suspended_at  timestamptz,
  add column anonymized_at timestamptz;

-- 사용자가 자기 프로필로 상태를 바꾸지 못하게 (프로필 수정 정책은 본인 행을 연다)
create function private.guard_account_state() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.is_system_context() then return new; end if;
  if new.suspended_at is distinct from old.suspended_at
     or new.anonymized_at is distinct from old.anonymized_at then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger account_state before update on public.profiles
  for each row execute function private.guard_account_state();

-- 업체의 유일한 소유자인가 (A10: 소유자 변경 전에는 탈퇴·익명화 불가)
create function private.is_sole_owner_somewhere(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.company_members m
    where m.user_id = p_user and m.role = 'owner' and m.removed_at is null
      and not exists (select 1 from public.company_members o
                      where o.company_id = m.company_id and o.role = 'owner'
                        and o.removed_at is null and o.user_id <> p_user))
$$;

-- 익명화 본체: 이름·연락처만 지우고 올린 자료·이력은 그대로 둔다 (삭제 아님)
create function private.anonymize_user(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if private.is_sole_owner_somewhere(p_user) then
    raise exception 'sole_owner' using errcode = 'P0001';
  end if;
  perform set_config('app.system_write', 'on', true);
  update public.profiles
     set display_name = '탈퇴한 사용자', anonymized_at = coalesce(anonymized_at, now())
   where id = p_user;
  update public.clients
     set name = '탈퇴한 사용자', phone = '', email = null
   where user_id = p_user;
  update public.company_members set removed_at = now()
   where user_id = p_user and removed_at is null;
  update public.project_participants set revoked_at = now()
   where user_id = p_user and revoked_at is null;
  perform set_config('app.system_write', 'off', true);
end $$;

-- ---------------------------------------------------------------------
-- 5. 관리자 RPC
-- ---------------------------------------------------------------------

-- A3 대시보드 숫자 (승인 대기 수는 업체관리자 파트의 업체 상태가 들어온 뒤 화면에서 따로 읽는다)
create function public.admin_dashboard()
returns table (companies bigint, users bigint, projects bigint, storage_bytes bigint,
               signups_7d bigint, suspended_users bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  return query select
    (select count(*) from public.companies),
    (select count(*) from public.profiles p where p.anonymized_at is null),
    (select count(*) from public.projects pr where pr.archived_at is null),
    (select coalesce(sum(f.size_bytes), 0)::bigint from public.files f where f.status = 'ready'),
    (select count(*) from public.profiles p where p.created_at >= now() - interval '7 days'),
    (select count(*) from public.profiles p where p.suspended_at is not null);
end $$;

-- A4 업체 목록
create function public.admin_companies(p_search text default null, p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, slug text, name text, created_at timestamptz, owner_id uuid, owner_name text,
               member_count bigint, project_count bigint, storage_bytes bigint, quota_bytes bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  return query
  select c.id, c.slug::text, c.name, c.created_at,
         o.user_id, op.display_name,
         (select count(*) from public.company_members m where m.company_id = c.id and m.removed_at is null),
         (select count(*) from public.projects p where p.company_id = c.id and p.archived_at is null),
         (select coalesce(sum(f.size_bytes), 0)::bigint from public.files f where f.company_id = c.id and f.status = 'ready'),
         private.company_quota_bytes(c.id)
  from public.companies c
  left join lateral (select m.user_id from public.company_members m
                     where m.company_id = c.id and m.role = 'owner' and m.removed_at is null
                     order by m.created_at limit 1) o on true
  left join public.profiles op on op.id = o.user_id
  where p_search is null or p_search = ''
     or c.name ilike '%' || p_search || '%' or c.slug::text ilike '%' || p_search || '%'
  order by c.created_at desc
  limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset);
end $$;

-- A4 소유자 변경 대상 후보 (현재 구성원)
create function public.admin_company_members(p_company uuid)
returns table (user_id uuid, display_name text, role public.member_role)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  return query
  select m.user_id, p.display_name, m.role
  from public.company_members m join public.profiles p on p.id = m.user_id
  where m.company_id = p_company and m.removed_at is null
  order by (m.role = 'owner') desc, p.display_name;
end $$;

-- A4 소유자 변경: 새 소유자는 현재 구성원이어야 하고, 기존 소유자는 manager 가 된다
create function public.admin_change_company_owner(p_company uuid, p_new_owner uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_old uuid;
begin
  perform private.require_platform_admin();
  if private.member_role_for(p_new_owner, p_company) is null then
    raise exception 'not_member' using errcode = 'P0001';
  end if;
  select m.user_id into v_old from public.company_members m
   where m.company_id = p_company and m.role = 'owner' and m.removed_at is null
   order by m.created_at limit 1;
  if v_old = p_new_owner then
    raise exception 'already_owner' using errcode = 'P0001';
  end if;
  perform set_config('app.system_write', 'on', true);
  update public.company_members set role = 'manager'
   where company_id = p_company and user_id = v_old;
  update public.company_members set role = 'owner'
   where company_id = p_company and user_id = p_new_owner;
  perform set_config('app.system_write', 'off', true);
  perform private.admin_log('company_owner_changed', 'company', p_company,
    jsonb_build_object('from', v_old, 'to', p_new_owner));
end $$;

-- A5 사용자 목록
create function public.admin_users(p_search text default null, p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, email text, display_name text, created_at timestamptz, last_sign_in_at timestamptz,
               suspended_at timestamptz, anonymized_at timestamptz, memberships jsonb, participation_count bigint,
               is_admin boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  return query
  select p.id, u.email::text, p.display_name, p.created_at, u.last_sign_in_at,
         p.suspended_at, p.anonymized_at,
         coalesce((select jsonb_agg(jsonb_build_object('company', c.name, 'slug', c.slug, 'role', m.role) order by c.name)
                   from public.company_members m join public.companies c on c.id = m.company_id
                   where m.user_id = p.id and m.removed_at is null), '[]'::jsonb),
         (select count(*) from public.project_participants pp where pp.user_id = p.id and pp.revoked_at is null),
         exists (select 1 from public.platform_admins a where a.user_id = p.id)
  from public.profiles p join auth.users u on u.id = p.id
  where p_search is null or p_search = ''
     or p.display_name ilike '%' || p_search || '%' or u.email ilike '%' || p_search || '%'
  order by p.created_at desc
  limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset);
end $$;

-- A5 정지·해제 (로그인 차단은 앱이 Auth 관리자 API 로 함께 건다)
create function public.admin_set_user_suspended(p_user uuid, p_suspended boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  if p_user = (select auth.uid()) then
    raise exception 'self_target' using errcode = 'P0001';
  end if;
  perform set_config('app.system_write', 'on', true);
  update public.profiles
     set suspended_at = case when p_suspended then coalesce(suspended_at, now()) else null end
   where id = p_user;
  perform set_config('app.system_write', 'off', true);
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform private.admin_log(case when p_suspended then 'user_suspended' else 'user_unsuspended' end, 'user', p_user);
end $$;

-- A5 삭제 대신 익명화 (이메일 변경·로그인 차단은 앱이 Auth 관리자 API 로 함께)
create function public.admin_anonymize_user(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  if p_user = (select auth.uid()) then
    raise exception 'self_target' using errcode = 'P0001';
  end if;
  perform private.anonymize_user(p_user);
  perform private.admin_log('user_anonymized', 'user', p_user);
end $$;

-- A5 비밀번호 재설정 링크 발급 기록 (링크 생성은 앱이 Auth 관리자 API 로)
create function public.admin_log_password_reset(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  perform private.admin_log('password_reset_issued', 'user', p_user);
end $$;

-- A6 사이트 설정 변경
create function public.admin_update_site_settings(
  p_photo_max_bytes bigint, p_photo_batch_max integer, p_design_max_bytes bigint, p_default_quota_bytes bigint)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_before jsonb;
begin
  perform private.require_platform_admin();
  select to_jsonb(s) into v_before from public.site_settings s where s.id;
  update public.site_settings
     set photo_max_bytes = p_photo_max_bytes, photo_batch_max = p_photo_batch_max,
         design_max_bytes = p_design_max_bytes, default_quota_bytes = p_default_quota_bytes,
         updated_at = now(), updated_by = (select auth.uid())
   where id;
  perform private.admin_log('site_settings_updated', 'site', null,
    jsonb_build_object('before', v_before - 'updated_at' - 'updated_by' - 'id'));
end $$;

-- A6 업체별 저장공간 한도 (null = 사이트 기본값 사용)
create function public.admin_set_company_quota(p_company uuid, p_quota_bytes bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  insert into public.company_quotas (company_id, quota_bytes, updated_by)
  values (p_company, p_quota_bytes, (select auth.uid()))
  on conflict (company_id) do update
    set quota_bytes = excluded.quota_bytes, updated_at = now(), updated_by = excluded.updated_by;
  perform private.admin_log('company_quota_updated', 'company', p_company,
    jsonb_build_object('quota_bytes', p_quota_bytes));
end $$;

-- A7 정리 대상 파일: 거부된 파일 + 24시간 넘게 어디에도 연결되지 않은 파일. 다른 곳에서 참조 중이면 제외
create function private.cleanup_file_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select f.id from public.files f
  where (f.status = 'rejected' or (f.owner_id is null and f.created_at < now() - interval '24 hours'))
    and not exists (select 1 from public.files d where d.derived_from = f.id)
    and not exists (select 1 from public.companies c where c.logo_file_id = f.id)
$$;

create function public.admin_cleanup_candidates()
returns table (id uuid, company_id uuid, company_name text, kind public.file_kind, status public.file_status,
               original_name text, size_bytes bigint, bucket text, path text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  return query
  select f.id, f.company_id, c.name, f.kind, f.status, f.original_name, f.size_bytes, f.bucket, f.path, f.created_at
  from public.files f join public.companies c on c.id = f.company_id
  where f.id in (select private.cleanup_file_ids())
  order by f.created_at;
end $$;

-- A7 파일 행 정리 (저장소 객체는 앱이 먼저 지운다). 후보가 아닌 id 는 무시한다
create function public.admin_purge_files(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  perform private.require_platform_admin();
  delete from public.files f
   where f.id = any(p_ids) and f.id in (select private.cleanup_file_ids());
  get diagnostics n = row_count;
  perform private.admin_log('files_purged', 'file', null, jsonb_build_object('count', n));
  return n;
end $$;

-- A7 읽은 알림 정리. 관리자 또는 예약 작업(서비스 역할·cron)만
create function public.admin_purge_read_notifications(p_days integer default 90) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  if not (private.is_platform_admin() or private.is_system_context() or (select auth.uid()) is null) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  delete from public.notifications
   where read_at is not null and read_at < now() - make_interval(days => greatest(p_days, 30));
  get diagnostics n = row_count;
  if n > 0 then
    perform private.admin_log('notifications_purged', 'notification', null,
      jsonb_build_object('count', n, 'days', p_days));
  end if;
  return n;
end $$;

-- A8 관리 기록 목록
create function public.admin_audit(p_limit integer default 100, p_offset integer default 0)
returns table (id bigint, actor_id uuid, actor_name text, action text, target_type text, target_id uuid,
               detail jsonb, occurred_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  return query
  select e.id, e.actor_id, p.display_name, e.action, e.target_type, e.target_id, e.detail, e.occurred_at
  from public.admin_audit_events e left join public.profiles p on p.id = e.actor_id
  order by e.occurred_at desc
  limit greatest(1, least(p_limit, 500)) offset greatest(0, p_offset);
end $$;

-- A10 본인 탈퇴 (로그인 차단·이메일 변경은 앱이 Auth 관리자 API 로 함께)
create function public.withdraw_me() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  perform private.anonymize_user(v_user);
  perform private.admin_log('self_withdrawn', 'user', v_user);
end $$;

-- ---------------------------------------------------------------------
-- 6. 예약 작업 (A7): pg_cron 이 켜진 환경에서만 등록. 없으면 관리자 화면의 버튼으로 실행
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-read-notifications', '0 18 * * *',  -- 매일 03:00 KST
                          'select public.admin_purge_read_notifications(90)');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 7. 권한 (a_grants_hardening 규칙 반복)
-- ---------------------------------------------------------------------
revoke all on public.platform_admins, public.site_settings, public.company_quotas, public.admin_audit_events
  from anon, authenticated;
grant select on public.platform_admins, public.site_settings, public.company_quotas, public.admin_audit_events
  to authenticated;

revoke execute on function private.is_platform_admin(), private.require_platform_admin(),
  private.company_quota_bytes(uuid), private.admin_log(text, text, uuid, jsonb),
  private.guard_account_state(), private.is_sole_owner_somewhere(uuid), private.anonymize_user(uuid),
  private.cleanup_file_ids()
  from public, anon;
grant execute on function private.is_platform_admin(), private.company_quota_bytes(uuid)
  to authenticated, service_role;

grant execute on function
  public.is_platform_admin(),
  public.admin_dashboard(),
  public.admin_companies(text, integer, integer),
  public.admin_company_members(uuid),
  public.admin_change_company_owner(uuid, uuid),
  public.admin_users(text, integer, integer),
  public.admin_set_user_suspended(uuid, boolean),
  public.admin_anonymize_user(uuid),
  public.admin_log_password_reset(uuid),
  public.admin_update_site_settings(bigint, integer, bigint, bigint),
  public.admin_set_company_quota(uuid, bigint),
  public.admin_cleanup_candidates(),
  public.admin_purge_files(uuid[]),
  public.admin_purge_read_notifications(integer),
  public.admin_audit(integer, integer),
  public.withdraw_me()
  to authenticated;
grant execute on function public.admin_purge_read_notifications(integer) to service_role;

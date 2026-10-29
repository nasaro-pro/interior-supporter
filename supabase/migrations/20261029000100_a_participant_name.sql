-- =====================================================================
-- 20261029000100_a_participant_name.sql
-- 소유: A · 참여자 수정에서 이름 바꾸기 (프로젝트 설정 > 참여자 > 수정) — CR 필요
--  - 디자이너(그 프로젝트 편집 권한)가 자기 프로젝트의 고객 · 시공팀 이름을 고친다
--  - 업체 구성원(디자이너 · 관리자) 이름은 본인만 고친다 → 여기서는 막는다
--  - 회수된 참여 · 익명화된 계정은 고치지 않는다
-- 프로필 수정 정책은 본인 행만 열려 있으므로 SECURITY DEFINER 함수로만 바꾼다
-- =====================================================================

create function public.update_participant_name(
  p_project uuid,
  p_participant uuid,
  p_display_name text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_role public.participant_role;
  v_revoked timestamptz;
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if not private.can_edit_project(p_project) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  select pp.user_id, pp.role, pp.revoked_at into v_user, v_role, v_revoked
    from public.project_participants pp
   where pp.id = p_participant and pp.project_id = p_project;
  if v_user is null then
    raise exception 'project_not_found' using errcode = 'P0001';
  end if;
  if v_role not in ('customer', 'field') or v_revoked is not null then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  -- 업체 구성원 계정은 본인만 이름을 바꾼다
  if exists (select 1 from public.company_members m
              where m.user_id = v_user and m.removed_at is null) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles p
              where p.id = v_user and p.anonymized_at is not null) then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  if char_length(v_name) not between 1 and 80 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  update public.profiles set display_name = v_name
   where id = v_user and display_name is distinct from v_name;
end $$;

revoke all on function public.update_participant_name(uuid, uuid, text) from public, anon;
grant execute on function public.update_participant_name(uuid, uuid, text) to authenticated;

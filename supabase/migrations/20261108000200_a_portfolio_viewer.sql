-- 공개 포트폴리오 머리의 '로그인 / 마이홈 / 관리 페이지' — 지금 보는 사람이 이 업체와 어떤 관계인지 (PUB-10·11 → CL-03 · PM-01)
-- 부르는 사람 자신의 관계만 돌려준다(남의 정보 없음). 고객 프로젝트는 고객 포털과 같은 조건(POL-004):
--   유효 고객 참여(철회 안 됨 · 기간 안, KST) + 프로젝트 공개 + 보관 안 됨
create function public.portfolio_viewer(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_company uuid;
  v_projects jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('role', 'guest');
  end if;
  select c.id into v_company from public.companies c where c.slug::text = lower(btrim(p_slug));
  if v_company is null then
    return jsonb_build_object('role', 'none');
  end if;
  if exists (
    select 1 from public.company_members m
     where m.company_id = v_company and m.user_id = v_uid and m.removed_at is null
  ) then
    return jsonb_build_object('role', 'staff');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id) order by p.start_date desc nulls last, p.created_at desc), '[]'::jsonb)
    into v_projects
    from public.projects p
   where p.company_id = v_company
     and p.is_public and p.archived_at is null
     and exists (
       select 1 from public.project_participants pp
        where pp.project_id = p.id and pp.user_id = v_uid and pp.role = 'customer'
          and pp.revoked_at is null
          and (pp.valid_from  is null or pp.valid_from  <= private.today_kst())
          and (pp.valid_until is null or pp.valid_until >= private.today_kst())
     );
  if jsonb_array_length(v_projects) > 0 then
    return jsonb_build_object('role', 'customer', 'projects', v_projects);
  end if;
  return jsonb_build_object('role', 'none');
end $$;

revoke all on function public.portfolio_viewer(text) from public;
grant execute on function public.portfolio_viewer(text) to anon, authenticated;

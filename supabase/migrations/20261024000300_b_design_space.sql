-- =====================================================================
-- 20261024000300_b_design_space.sql
-- 소유: B · 디자이너 페이지 D-26~D-28 (CR-7) — 고객 페이지 CU-03·CU-04 와 짝
--  - space: 도안의 공간 (자재와 같은 목록, null = 전체)
--  - is_main: 대표 도안 (프로젝트당 보관되지 않은 것 1개)
--  - sort_order: 디자이너가 정한 순서 (공간 순서는 그 공간 첫 도안의 순서를 따른다)
-- 모두 편집자가 바꾸는 표시용 값 — 확정 상태(재확인)에는 영향 없음
-- =====================================================================

alter table public.designs
  add column space public.material_space,
  add column is_main boolean not null default false,
  add column sort_order integer not null default 0 check (sort_order >= 0);

create unique index designs_one_main_per_project
  on public.designs (project_id) where is_main and archived_at is null;

-- 보관하면 대표 표시를 내린다 (보관된 대표가 새 대표 지정을 막지 않도록)
create function private.design_unset_main_on_archive() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.archived_at is not null and old.archived_at is null then
    new.is_main := false;
  end if;
  return new;
end $$;
create trigger b_unset_main before update of archived_at on public.designs
  for each row execute function private.design_unset_main_on_archive();

-- D-27 대표 도안 지정: 같은 프로젝트의 기존 대표를 내리고 이 도안을 대표로 (호출자 권한 · RLS 적용)
create function public.set_main_design(p_design uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare v_project uuid;
begin
  select d.project_id into v_project from public.designs d
  where d.id = p_design and d.archived_at is null;
  if v_project is null or not private.can_edit_project(v_project) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  update public.designs set is_main = false
   where project_id = v_project and is_main and id <> p_design;
  update public.designs set is_main = true where id = p_design and not is_main;
end $$;

-- D-28 순서: 받은 id 순서대로 sort_order = 0,1,2… (이 프로젝트의 도안만 바뀐다)
create function public.reorder_designs(p_project uuid, p_ids uuid[]) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not private.can_edit_project(p_project) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  update public.designs d
     set sort_order = o.ord - 1
    from unnest(p_ids) with ordinality as o(id, ord)
   where d.id = o.id and d.project_id = p_project and d.sort_order is distinct from o.ord - 1;
end $$;

revoke all on function public.set_main_design(uuid) from public, anon;
revoke all on function public.reorder_designs(uuid, uuid[]) from public, anon;
grant execute on function public.set_main_design(uuid) to authenticated;
grant execute on function public.reorder_designs(uuid, uuid[]) to authenticated;

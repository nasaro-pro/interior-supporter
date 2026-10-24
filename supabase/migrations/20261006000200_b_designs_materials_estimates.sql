-- =====================================================================
-- 20261006000200_b_designs_materials_estimates.sql
-- 소유: B (류영걸) · 베이스라인(동결) · 관련: REQ-100~133, POL-011~016, POL-021
-- 내용: 도안(+버전·비교 이미지)·자재·견적(+버전)·확정 기록, RLS, 확정 RPC, 알림 규칙
-- 의존: 20261006000100_a_foundation.sql (헬퍼·감사·알림·파일 연결 함수)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 테이블
-- ---------------------------------------------------------------------

-- ENT-design
create table public.designs (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id),
  project_id       uuid not null references public.projects(id),
  title            text not null check (char_length(title) between 1 and 120),
  description      text not null default '' check (char_length(description) <= 2000),
  is_public        boolean not null default false,
  confirm_state    public.confirm_state not null default 'none',   -- 시스템 전용
  current_version  integer not null default 0,                    -- 시스템 전용 (= 확정 리비전)
  created_by       uuid not null references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz,
  version          integer not null default 1
);
create index designs_project_idx on public.designs (project_id);

-- ENT-design_version (POL-014: 모든 버전 보존, 덮어쓰기·삭제 없음)
create table public.design_versions (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id),
  project_id   uuid not null references public.projects(id),
  design_id    uuid not null references public.designs(id),
  version_no   integer not null check (version_no >= 1),
  file_id      uuid not null unique references public.files(id),
  note         text not null default '' check (char_length(note) <= 500),
  uploaded_by  uuid not null references auth.users(id),
  created_at   timestamptz not null default now(),
  unique (design_id, version_no)
);

-- ENT-design_preview (비교 이미지. SKP/DWG 는 연결 이미지, PDF 는 페이지 PNG)
create table public.design_previews (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(id),
  project_id         uuid not null references public.projects(id),
  design_id          uuid not null references public.designs(id),
  design_version_id  uuid references public.design_versions(id),
  file_id            uuid not null unique references public.files(id),
  label              text not null check (char_length(label) between 1 and 80),
  pdf_page           integer check (pdf_page is null or pdf_page >= 1),
  created_by         uuid not null references auth.users(id),
  created_at         timestamptz not null default now(),
  archived_at        timestamptz
);
create index design_previews_design_idx on public.design_previews (design_id);

-- ENT-material (구매·발주 상태 없음)
create table public.materials (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id),
  project_id     uuid not null references public.projects(id),
  name           text not null check (char_length(name) between 1 and 120),
  category       text not null default '' check (char_length(category) <= 40),
  space          public.material_space not null default 'other',
  spec           text not null default '' check (char_length(spec) <= 1000),
  quantity       numeric(12, 2) check (quantity is null or quantity >= 0),
  unit           text not null default '' check (char_length(unit) <= 20),
  unit_price     numeric(14, 0) check (unit_price is null or unit_price >= 0),   -- KRW, 부가세 포함 여부는 description 에 명시
  image_file_id  uuid references public.files(id),
  location_note  text not null default '' check (char_length(location_note) <= 200),
  description    text not null default '' check (char_length(description) <= 2000),
  is_public      boolean not null default false,
  confirm_state  public.confirm_state not null default 'none',    -- 시스템 전용
  revision       integer not null default 1,                      -- 시스템 전용 (핵심 필드 변경 시 +1)
  created_by     uuid not null references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  archived_at    timestamptz,
  version        integer not null default 1
);
create index materials_project_idx on public.materials (project_id);

-- ENT-estimate (견적 묶음)
create table public.estimates (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id),
  project_id   uuid not null references public.projects(id),
  title        text not null check (char_length(title) between 1 and 120),
  created_by   uuid not null references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  archived_at  timestamptz,
  version      integer not null default 1
);
create index estimates_project_idx on public.estimates (project_id);

-- ENT-estimate_version (POL-015: 버전별 공개. 파일 교체 불가)
create table public.estimate_versions (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id),
  project_id     uuid not null references public.projects(id),
  estimate_id    uuid not null references public.estimates(id),
  version_no     integer not null,            -- 트리거가 부여
  version_label  text not null check (char_length(version_label) between 1 and 40),
  file_id        uuid not null unique references public.files(id),
  change_note    text not null check (char_length(change_note) between 1 and 1000),
  is_public      boolean not null default false,
  published_at   timestamptz,                -- 트리거가 최초 공개 시각 기록
  uploaded_by    uuid not null references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  archived_at    timestamptz,
  version        integer not null default 1,
  unique (estimate_id, version_no)
);

-- ENT-confirmation (POL-011~013: 확정 기록은 보존, 무효화만 기록)
create table public.confirmations (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id),
  project_id          uuid not null references public.projects(id),
  target_type         text not null check (target_type in ('designs', 'materials')),
  target_id           uuid not null,
  target_revision     integer not null,
  snapshot            jsonb not null,            -- 확정 당시 핵심 값
  confirmed_by        uuid not null references auth.users(id),
  confirmed_at        timestamptz not null default now(),
  invalidated_at      timestamptz,
  invalidated_by      uuid references auth.users(id),
  invalidated_reason  text check (invalidated_reason is null or char_length(invalidated_reason) <= 500),
  unique (target_type, target_id, target_revision)
);
create index confirmations_target_idx on public.confirmations (target_type, target_id);

-- ---------------------------------------------------------------------
-- 2. 열람 판정 함수 (RLS + 파일 다운로드 공용. 규약: private.row_visible_<table>)
-- ---------------------------------------------------------------------

create function private.row_visible_designs(d public.designs) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_edit_project(d.project_id)
      or (d.is_public and d.archived_at is null and private.can_view_as_customer(d.project_id))
$$;

-- 고객은 현재 버전만 (POL-014)
create function private.row_visible_design_versions(v public.design_versions) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_edit_project(v.project_id)
      or exists (select 1 from public.designs d
                 where d.id = v.design_id and d.current_version = v.version_no
                   and d.is_public and d.archived_at is null
                   and private.can_view_as_customer(d.project_id))
$$;

create function private.row_visible_design_previews(p public.design_previews) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_edit_project(p.project_id)
      or (p.archived_at is null and exists (
            select 1 from public.designs d
            left join public.design_versions v on v.id = p.design_version_id
            where d.id = p.design_id and d.is_public and d.archived_at is null
              and (p.design_version_id is null or v.version_no = d.current_version)
              and private.can_view_as_customer(d.project_id)))
$$;

create function private.row_visible_materials(m public.materials) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_edit_project(m.project_id)
      or (m.is_public and m.archived_at is null and private.can_view_as_customer(m.project_id))
$$;

create function private.row_visible_estimates(e public.estimates) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_edit_project(e.project_id)
      or (e.archived_at is null and private.can_view_as_customer(e.project_id)
          and exists (select 1 from public.estimate_versions v
                      where v.estimate_id = e.id and v.is_public and v.archived_at is null))
$$;

create function private.row_visible_estimate_versions(v public.estimate_versions) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_edit_project(v.project_id)
      or (v.is_public and v.archived_at is null and exists (
            select 1 from public.estimates e
            where e.id = v.estimate_id and e.archived_at is null
              and private.can_view_as_customer(e.project_id)))
$$;

create function private.row_visible_confirmations(c public.confirmations) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_edit_project(c.project_id)
      or (private.can_view_as_customer(c.project_id) and case c.target_type
            when 'designs'   then exists (select 1 from public.designs d   where d.id = c.target_id and private.row_visible_designs(d))
            when 'materials' then exists (select 1 from public.materials m where m.id = c.target_id and private.row_visible_materials(m))
            else false end)
$$;

-- ---------------------------------------------------------------------
-- 3. 트리거 함수
-- ---------------------------------------------------------------------

-- 확정 무효화 공통 (POL-012, POL-013)
create function private.invalidate_confirmation(p_type text, p_id uuid, p_reason text) returns void
language sql security definer set search_path = '' as $$
  update public.confirmations
     set invalidated_at = now(), invalidated_by = auth.uid(), invalidated_reason = p_reason
   where target_type = p_type and target_id = p_id and invalidated_at is null;
$$;

-- 자재: 시스템 컬럼 보호 + 핵심 필드 변경 감지 → revision+1, 확정이면 재확인 필요 (POL-012)
create function private.material_before_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.is_system_context() then return new; end if;
  if new.confirm_state is distinct from old.confirm_state then
    raise exception 'system_column:confirm_state' using errcode = 'P0001';
  end if;
  if new.revision is distinct from old.revision then
    raise exception 'system_column:revision' using errcode = 'P0001';
  end if;
  if (new.name, new.category, new.space, new.spec, new.quantity, new.unit, new.unit_price, new.image_file_id)
     is distinct from
     (old.name, old.category, old.space, old.spec, old.quantity, old.unit, old.unit_price, old.image_file_id) then
    new.revision := old.revision + 1;
    if old.confirm_state = 'confirmed' then
      new.confirm_state := 'needs_reconfirm';
      perform private.invalidate_confirmation('materials', old.id, 'core_changed');
    end if;
  end if;
  return new;
end $$;

create function private.material_insert_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.confirm_state := 'none';
  new.revision := 1;
  new.created_by := auth.uid();
  return new;
end $$;

create function private.material_attach_image() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.image_file_id is not null and (tg_op = 'INSERT' or new.image_file_id is distinct from old.image_file_id) then
    perform private.attach_file(new.image_file_id, 'materials', new.id, new.project_id, array['material_image']::public.file_kind[]);
  end if;
  return null;
end $$;

create function private.design_preview_attach() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.design_version_id is not null and not exists (
    select 1 from public.design_versions v where v.id = new.design_version_id and v.design_id = new.design_id) then
    raise exception 'scope_mismatch' using errcode = 'P0001';
  end if;
  perform private.attach_file(new.file_id, 'design_previews', new.id, new.project_id, array['design_preview']::public.file_kind[]);
  return null;
end $$;

-- 견적 버전: 번호 부여(동시 업로드 직렬화), 최초 공개 시각, 파일 연결
create function private.estimate_version_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.estimates where id = new.estimate_id for update;
  select coalesce(max(version_no), 0) + 1 into new.version_no
    from public.estimate_versions where estimate_id = new.estimate_id;
  new.uploaded_by := auth.uid();
  new.published_at := case when new.is_public then now() else null end;
  return new;
end $$;

create function private.estimate_version_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.is_public and not old.is_public and old.published_at is null then
    new.published_at := now();
  elsif new.published_at is distinct from old.published_at and not private.is_system_context() then
    new.published_at := old.published_at;
  end if;
  return new;
end $$;

create function private.estimate_version_attach() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.attach_file(new.file_id, 'estimate_versions', new.id, new.project_id, array['estimate_pdf']::public.file_kind[]);
  return null;
end $$;

-- 공개 전환 알림 (POL-027): designs / materials / estimate_versions
create function private.notify_published() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.is_public and new.archived_at is null
     and (tg_op = 'INSERT' or not old.is_public) then
    perform private.notify_participants(new.project_id, 'customer', 'item_published', tg_table_name, new.id);
  end if;
  return null;
end $$;

-- 재확인 필요 전환 알림 → 확정권 고객
create function private.notify_reconfirm() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.confirm_state = 'needs_reconfirm' and old.confirm_state is distinct from 'needs_reconfirm' then
    perform private.notify_participants(new.project_id, 'customer', 'reconfirm_requested', tg_table_name, new.id, null, true);
  end if;
  return null;
end $$;

create function private.notify_confirmed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_participants(new.project_id, 'pm', 'item_confirmed', new.target_type, new.target_id);
  return null;
end $$;

-- 트리거 연결 ---------------------------------------------------------
create trigger scope before insert on public.designs           for each row execute function private.set_scope_from_project();
create trigger scope before insert on public.materials         for each row execute function private.set_scope_from_project();
create trigger scope before insert on public.estimates         for each row execute function private.set_scope_from_project();
create trigger scope before insert on public.design_versions   for each row execute function private.set_scope_from_parent('designs', 'design_id');
create trigger scope before insert on public.design_previews   for each row execute function private.set_scope_from_parent('designs', 'design_id');
create trigger scope before insert on public.estimate_versions for each row execute function private.set_scope_from_parent('estimates', 'estimate_id');

create trigger touch before update on public.designs           for each row execute function private.touch_row();
create trigger touch before update on public.materials         for each row execute function private.touch_row();
create trigger touch before update on public.estimates         for each row execute function private.touch_row();
create trigger touch before update on public.estimate_versions for each row execute function private.touch_row();

create trigger immutable before update on public.designs   for each row execute function private.guard_immutable('company_id', 'project_id', 'created_by');
create trigger immutable before update on public.materials for each row execute function private.guard_immutable('company_id', 'project_id', 'created_by');
create trigger immutable before update on public.estimates for each row execute function private.guard_immutable('company_id', 'project_id', 'created_by');
create trigger immutable before update on public.estimate_versions for each row execute function private.guard_immutable('company_id', 'project_id', 'estimate_id', 'version_no', 'file_id', 'uploaded_by');
create trigger immutable before update on public.design_previews   for each row execute function private.guard_immutable('company_id', 'project_id', 'design_id', 'design_version_id', 'file_id', 'created_by');
create trigger system_cols before update on public.designs for each row execute function private.guard_system_columns('confirm_state', 'current_version');

create trigger a_defaults before insert on public.materials for each row execute function private.material_insert_defaults();
create trigger b_core before update on public.materials for each row execute function private.material_before_update();
create trigger attach after insert or update of image_file_id on public.materials for each row execute function private.material_attach_image();
create trigger attach after insert on public.design_previews for each row execute function private.design_preview_attach();
create trigger a_number before insert on public.estimate_versions for each row execute function private.estimate_version_before_insert();
create trigger b_publish before update on public.estimate_versions for each row execute function private.estimate_version_before_update();
create trigger attach after insert on public.estimate_versions for each row execute function private.estimate_version_attach();

create trigger notify_published after insert or update of is_public on public.designs           for each row execute function private.notify_published();
create trigger notify_published after insert or update of is_public on public.materials         for each row execute function private.notify_published();
create trigger notify_published after insert or update of is_public on public.estimate_versions for each row execute function private.notify_published();
-- 주의: 'UPDATE OF 컬럼' 트리거는 BEFORE 트리거가 바꾼 컬럼에는 발동하지 않는다 → WHEN 조건 사용
create trigger notify_reconfirm after update on public.designs   for each row
  when (old.confirm_state is distinct from new.confirm_state) execute function private.notify_reconfirm();
create trigger notify_reconfirm after update on public.materials for each row
  when (old.confirm_state is distinct from new.confirm_state) execute function private.notify_reconfirm();
create trigger notify_confirmed after insert on public.confirmations for each row execute function private.notify_confirmed();

create trigger audit after insert or update on public.designs           for each row execute function private.audit_row();
create trigger audit after insert or update on public.design_versions   for each row execute function private.audit_row();
create trigger audit after insert or update on public.design_previews   for each row execute function private.audit_row();
create trigger audit after insert or update on public.materials         for each row execute function private.audit_row();
create trigger audit after insert or update on public.estimates         for each row execute function private.audit_row();
create trigger audit after insert or update on public.estimate_versions for each row execute function private.audit_row();
create trigger audit after insert or update on public.confirmations     for each row execute function private.audit_row();

-- ---------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------
alter table public.designs           enable row level security;
alter table public.design_versions   enable row level security;
alter table public.design_previews   enable row level security;
alter table public.materials         enable row level security;
alter table public.estimates         enable row level security;
alter table public.estimate_versions enable row level security;
alter table public.confirmations     enable row level security;

-- designs: 생성·새 버전은 RPC 전용. UPDATE 는 제목·설명·공개·보관만 (시스템 컬럼 트리거 보호)
create policy designs_select on public.designs for select to authenticated using (private.row_visible_designs(designs));
create policy designs_update on public.designs for update to authenticated
  using (private.can_edit_project(project_id)) with check (private.can_edit_project(project_id));

create policy design_versions_select on public.design_versions for select to authenticated
  using (private.row_visible_design_versions(design_versions));

create policy design_previews_select on public.design_previews for select to authenticated
  using (private.row_visible_design_previews(design_previews));
create policy design_previews_insert on public.design_previews for insert to authenticated
  with check (private.can_edit_project(project_id) and created_by = (select auth.uid()));
create policy design_previews_update on public.design_previews for update to authenticated
  using (private.can_edit_project(project_id)) with check (private.can_edit_project(project_id));

create policy materials_select on public.materials for select to authenticated using (private.row_visible_materials(materials));
create policy materials_insert on public.materials for insert to authenticated
  with check (private.can_edit_project(project_id));
create policy materials_update on public.materials for update to authenticated
  using (private.can_edit_project(project_id)) with check (private.can_edit_project(project_id));

create policy estimates_select on public.estimates for select to authenticated using (private.row_visible_estimates(estimates));
create policy estimates_insert on public.estimates for insert to authenticated
  with check (private.can_edit_project(project_id) and created_by = (select auth.uid()));
create policy estimates_update on public.estimates for update to authenticated
  using (private.can_edit_project(project_id)) with check (private.can_edit_project(project_id));

create policy estimate_versions_select on public.estimate_versions for select to authenticated
  using (private.row_visible_estimate_versions(estimate_versions));
create policy estimate_versions_insert on public.estimate_versions for insert to authenticated
  with check (private.can_edit_project((select e.project_id from public.estimates e where e.id = estimate_id)));
create policy estimate_versions_update on public.estimate_versions for update to authenticated
  using (private.can_edit_project(project_id)) with check (private.can_edit_project(project_id));

-- confirmations: 조회만. 생성·무효화는 RPC 전용
create policy confirmations_select on public.confirmations for select to authenticated
  using (private.row_visible_confirmations(confirmations));

-- ---------------------------------------------------------------------
-- 5. RPC
-- ---------------------------------------------------------------------

-- IF-rpc-create-design: 도안 + 1번 버전 원자적 생성 (REQ-101)
create function public.create_design(
  p_project uuid, p_title text, p_description text, p_file uuid, p_note text, p_is_public boolean
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_design uuid; v_version uuid;
begin
  if not private.can_edit_project(p_project) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  perform set_config('app.system_write', 'on', true);
  insert into public.designs (project_id, company_id, title, description, is_public, current_version, created_by)
  values (p_project, '00000000-0000-0000-0000-000000000000', p_title, coalesce(p_description, ''),
          coalesce(p_is_public, false), 1, auth.uid())
  returning id into v_design;
  insert into public.design_versions (design_id, company_id, project_id, version_no, file_id, note, uploaded_by)
  values (v_design, '00000000-0000-0000-0000-000000000000', p_project, 1, p_file, coalesce(p_note, ''), auth.uid())
  returning id into v_version;
  perform private.attach_file(p_file, 'design_versions', v_version, p_project, array['design_original']::public.file_kind[]);
  perform set_config('app.system_write', 'off', true);
  return v_design;
end $$;

-- IF-rpc-add-design-version: 새 버전 추가. 확정 상태면 재확인 필요 (REQ-102, POL-012)
create function public.add_design_version(p_design uuid, p_file uuid, p_note text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare d public.designs; v_version uuid;
begin
  select * into d from public.designs where id = p_design for update;
  if d.id is null or not private.can_edit_project(d.project_id) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if d.archived_at is not null then raise exception 'archived' using errcode = 'P0001'; end if;
  perform set_config('app.system_write', 'on', true);
  insert into public.design_versions (design_id, company_id, project_id, version_no, file_id, note, uploaded_by)
  values (d.id, d.company_id, d.project_id, d.current_version + 1, p_file, coalesce(p_note, ''), auth.uid())
  returning id into v_version;
  perform private.attach_file(p_file, 'design_versions', v_version, d.project_id, array['design_original']::public.file_kind[]);
  update public.designs
     set current_version = d.current_version + 1,
         confirm_state = case when d.confirm_state = 'confirmed' then 'needs_reconfirm'::public.confirm_state else d.confirm_state end
   where id = d.id;
  if d.confirm_state = 'confirmed' then
    perform private.invalidate_confirmation('designs', d.id, 'new_version');
  end if;
  perform set_config('app.system_write', 'off', true);
  return v_version;
end $$;

-- IF-rpc-confirm-target: 지정 고객의 확정 (REQ-120, POL-011, POL-013)
create function public.confirm_target(p_target_type text, p_target_id uuid, p_revision integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_project uuid; v_revision integer; v_state public.confirm_state; v_public boolean; v_archived timestamptz;
  v_snapshot jsonb; v_id uuid;
begin
  if p_target_type = 'designs' then
    select project_id, current_version, confirm_state, is_public, archived_at,
           jsonb_build_object('title', title, 'version_no', current_version)
      into v_project, v_revision, v_state, v_public, v_archived, v_snapshot
      from public.designs where id = p_target_id for update;
  elsif p_target_type = 'materials' then
    select project_id, revision, confirm_state, is_public, archived_at,
           jsonb_build_object('name', name, 'category', category, 'space', space, 'spec', spec,
                              'quantity', quantity, 'unit', unit, 'unit_price', unit_price, 'image_file_id', image_file_id)
      into v_project, v_revision, v_state, v_public, v_archived, v_snapshot
      from public.materials where id = p_target_id for update;
  else
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;

  if v_project is null or not coalesce(v_public, false) or v_archived is not null
     or not private.can_confirm_on(v_project) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if p_revision is distinct from v_revision then
    raise exception 'stale_revision' using errcode = 'P0001';
  end if;
  if v_state = 'confirmed' then
    raise exception 'already_confirmed' using errcode = 'P0001';
  end if;

  perform set_config('app.system_write', 'on', true);
  insert into public.confirmations (company_id, project_id, target_type, target_id, target_revision, snapshot, confirmed_by)
  values ((select company_id from public.projects where id = v_project), v_project, p_target_type, p_target_id,
          v_revision, v_snapshot, auth.uid())
  returning id into v_id;
  execute format('update public.%I set confirm_state = %L where id = $1', p_target_type, 'confirmed') using p_target_id;
  perform set_config('app.system_write', 'off', true);
  return v_id;
exception when unique_violation then
  raise exception 'already_confirmed' using errcode = 'P0001';
end $$;

-- IF-rpc-request-reconfirm: PM 재확인 요청 (POL-013)
create function public.request_reconfirm(p_target_type text, p_target_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_project uuid; v_state public.confirm_state;
begin
  if p_target_type not in ('designs', 'materials') then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  if coalesce(char_length(trim(p_reason)), 0) = 0 or char_length(p_reason) > 500 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  execute format('select project_id, confirm_state from public.%I where id = $1 for update', p_target_type)
    into v_project, v_state using p_target_id;
  if v_project is null or not private.can_edit_project(v_project) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if v_state <> 'confirmed' then
    raise exception 'not_confirmed' using errcode = 'P0001';
  end if;
  perform set_config('app.system_write', 'on', true);
  perform private.invalidate_confirmation(p_target_type, p_target_id, 'pm_request: ' || p_reason);
  execute format('update public.%I set confirm_state = %L where id = $1', p_target_type, 'needs_reconfirm') using p_target_id;
  perform set_config('app.system_write', 'off', true);
end $$;

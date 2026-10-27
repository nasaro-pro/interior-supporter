-- =====================================================================
-- 20261025000400_c_photo_comments.sql
-- 소유: C · 디자이너 페이지 D-34 (고객 페이지 CU-07 과 짝) — CR-7
-- 현장 사진 댓글: 고객은 공개 사진에 댓글, 디자이너(편집자)는 그 고객에게 답글.
--  - 대화는 고객별로 나뉜다(thread_owner = 그 고객). 고객은 자기 대화만, 편집자는 전체를 본다
--  - 시공팀은 댓글을 보지 않는다 (POL-005)
--  - 추가 전용 (수정 · 삭제 없음, POL-019 와 같음)
--  - 알림: 고객 댓글 → 배정 담당자(pm), 답글 → 그 고객
-- =====================================================================

create table public.photo_comments (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id),
  project_id    uuid not null references public.projects(id),
  photo_id      uuid not null references public.photos(id),
  author_id     uuid not null references auth.users(id),
  thread_owner  uuid not null references auth.users(id),
  body          text not null check (char_length(body) between 1 and 1000),
  created_at    timestamptz not null default now()
);
create index photo_comments_photo_idx on public.photo_comments (photo_id, thread_owner, created_at);

-- 범위 강제: project_id · company_id 는 사진에서 복사 (클라이언트 값 무시)
create function private.photo_comment_defaults() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_project uuid; v_company uuid;
begin
  select p.project_id, p.company_id into v_project, v_company from public.photos p where p.id = new.photo_id;
  if v_project is null then
    raise exception 'photo_not_found' using errcode = 'P0001';
  end if;
  new.project_id := v_project;
  new.company_id := v_company;
  new.author_id := auth.uid();
  new.created_at := now();
  return new;
end $$;
create trigger a_defaults before insert on public.photo_comments
  for each row execute function private.photo_comment_defaults();

-- 고객이 볼 수 있는 사진 = 공개 + 보관 안 됨 + 고객 열람 가능 프로젝트
create function private.customer_can_see_photo(p_photo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.photos p
    where p.id = p_photo and p.is_public and p.archived_at is null
      and private.can_view_as_customer(p.project_id)
  )
$$;

-- 그 고객이 이 사진에 댓글을 단 적이 있는가 (정책 안 자기 참조 재귀 방지용 SECURITY DEFINER)
create function private.customer_commented(p_photo uuid, p_customer uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.photo_comments c
                 where c.photo_id = p_photo and c.author_id = p_customer and c.thread_owner = p_customer)
$$;

alter table public.photo_comments enable row level security;
create policy photo_comments_select on public.photo_comments for select to authenticated
  using (private.can_edit_project(project_id)
         or (thread_owner = (select auth.uid()) and private.customer_can_see_photo(photo_id)));
-- 고객: 자기 대화에 댓글 / 편집자: 이미 댓글을 단 고객의 대화에 답글
create policy photo_comments_insert on public.photo_comments for insert to authenticated
  with check (
    author_id = (select auth.uid()) and (
      (thread_owner = (select auth.uid()) and private.customer_can_see_photo(photo_id))
      or (private.can_edit_project(project_id) and thread_owner <> (select auth.uid())
          and private.customer_commented(photo_id, thread_owner))
    ));
grant select, insert on public.photo_comments to authenticated;
revoke update, delete on public.photo_comments from authenticated, anon;

-- 알림 종류 추가
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'assignment_changed',
  'item_published', 'item_confirmed', 'reconfirm_requested',
  'request_created', 'request_corrected', 'request_replied', 'request_status_changed',
  'photo_uploaded', 'photo_published', 'schedule_changed',
  'photo_commented', 'photo_comment_replied'));

create function private.notify_photo_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.author_id = new.thread_owner then
    perform private.notify_participants(new.project_id, 'pm', 'photo_commented', 'photos', new.photo_id);
  else
    perform private.notify_participants(new.project_id, 'customer', 'photo_comment_replied', 'photos',
                                        new.photo_id, new.thread_owner);
  end if;
  return null;
end $$;
create trigger notify after insert on public.photo_comments
  for each row execute function private.notify_photo_comment();

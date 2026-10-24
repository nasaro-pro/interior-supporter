-- =====================================================================
-- 20261013000130_a_assignment_notify.sql
-- 소유: A (박예원) · 파트 2 · 결함 DB-06 (일반)
-- 문제: participant_notify 가 notify_participants 를 쓰는데, 그 수신자 필터(has_participation_for)가
--       "미회수 + 기간 안" 이라 회수·기간 만료·시작 전 배정 변경은 당사자에게 알림이 가지 않았다.
--       문서: 배정 변경(참여자 추가·기간·회수·확정권 변경)은 "해당 사용자"에게 assignment_changed (docs/03 6.2).
-- 수정: 대상 1인에게 직접 기록. 고객은 프로젝트가 공개·미보관일 때만 (6.2 "고객 대상은 프로젝트 공개 시에만").
-- =====================================================================

create or replace function private.participant_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id is distinct from auth.uid()
     and (new.role <> 'customer' or exists (
           select 1 from public.projects p
           where p.id = new.project_id and p.is_public and p.archived_at is null)) then
    insert into public.notifications (recipient_id, company_id, project_id, type, object_type, object_id)
    values (new.user_id, new.company_id, new.project_id, 'assignment_changed', 'project_participants', new.id);
  end if;
  return null;
end $$;

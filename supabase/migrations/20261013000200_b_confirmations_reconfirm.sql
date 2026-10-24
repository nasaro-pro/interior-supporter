-- =====================================================================
-- 20261013000200_b_confirmations_reconfirm.sql
-- 소유: B (류영걸) · 파트 2 · 결함 DB-01 (중대), DB-02 (일반) · CR-INT-03 (통합 책임자 잠정 승인)
-- DB-01: request_reconfirm 은 리비전을 올리지 않고 needs_reconfirm 으로만 바꾸는데, confirmations 가
--        unique(target_type, target_id, target_revision) 라서 같은 리비전 재확정이 unique 위반 → already_confirmed 로
--        영구 거절됐다 (ST-100 "needs_reconfirm → confirmed" 불가).
--        → "유효한(무효화되지 않은) 확정은 대상당 1건" 부분 unique 로 바꾼다. 동시 확정은 confirm_target 의
--          FOR UPDATE 잠금 + 이 인덱스로 1건만 성공 (unique_violation → already_confirmed 유지).
-- DB-02: 무효화 사유 = 'pm_request: ' (12자) || 사유(≤500) 인데 CHECK ≤500 → 489~500자 사유가 23514 로 실패.
--        → CHECK 를 ≤520 으로 완화 (입력 한도 500 은 RPC·zod 가 그대로 지킨다).
-- =====================================================================

alter table public.confirmations
  drop constraint confirmations_target_type_target_id_target_revision_key;
create unique index confirmations_active_uniq
  on public.confirmations (target_type, target_id) where invalidated_at is null;
create index confirmations_target_revision_idx
  on public.confirmations (target_type, target_id, target_revision);

alter table public.confirmations
  drop constraint confirmations_invalidated_reason_check,
  add constraint confirmations_invalidated_reason_check
    check (invalidated_reason is null or char_length(invalidated_reason) <= 520);

// src/features/admin/lib/db-errors.ts — 사이트 관리 RPC 의 raise exception 문구 → 화면 오류
// 공통 매핑(mapDbError)에 없는 문구만 여기서 바꾼다. 원문은 20261026000100_a_site_admin.sql
import type { ErrorCode } from '@/shared/contracts/errors';

export interface AdminDbError {
  code: ErrorCode;
  /** messages/<locale>/admin.json 의 error.* 키 (화면에 사유를 보여줄 때) */
  reasonKey?: string;
}

const REASONS: Record<string, AdminDbError> = {
  not_member: { code: 'CONFLICT', reasonKey: 'error.notMember' },
  already_owner: { code: 'CONFLICT', reasonKey: 'error.alreadyOwner' },
  self_target: { code: 'CONFLICT', reasonKey: 'error.selfTarget' },
  sole_owner: { code: 'CONFLICT', reasonKey: 'error.soleOwner' },
  not_found: { code: 'NOT_FOUND' },
};

/** 알려진 사유면 그 결과, 아니면 null (호출부가 공통 dbFail 로 넘긴다) */
export function explainAdminDbError(message: string | undefined): AdminDbError | null {
  if (!message) return null;
  const key = Object.keys(REASONS).find((k) => message === k || message.endsWith(`: ${k}`));
  return key ? (REASONS[key] ?? null) : null;
}

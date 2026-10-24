// C Server Action 공통 처리 (requests·photos·schedule 공용, C-12) — 03 문서 5.1 표준 형태의 반복 부분
import 'server-only';
import { z } from 'zod';
import { fail, mapDbError, type ActionResult } from '@/shared/contracts/errors';
import { logger, newRef, type LogFields } from '@/shared/lib/logger';

/** zod 실패 → VALIDATION_FAILED + 필드별 메시지 키 */
export function validationFail(error: z.ZodError): ActionResult<never> {
  const fieldErrors = z.flattenError(error).fieldErrors as Record<string, string[]>;
  return fail('VALIDATION_FAILED', { fieldErrors });
}

/** DB 오류 → 로그(허용 필드만) + ErrorCode + 문의 코드 */
export function dbFail(
  event: string,
  error: { code?: string; message?: string },
  fields: LogFields,
): ActionResult<never> {
  const ref = newRef();
  logger.warn(event, { ...fields, ref, dbCode: error.code });
  return fail(mapDbError(error), { ref });
}

/**
 * 조건부 update 가 0행일 때 원인 구분 (C-04) — 다시 읽은 현재 행으로 판단한다.
 * 없음·볼 수 없음 → NOT_FOUND(존재 숨김) / 보관됨 → CONFLICT / 그 밖(다른 사람이 먼저 바꿈) → VERSION_CONFLICT
 */
export function explainZeroRow(
  current: { archived_at: string | null } | null | undefined,
): ActionResult<never> {
  if (!current) return fail('NOT_FOUND');
  if (current.archived_at) return fail('CONFLICT');
  return fail('VERSION_CONFLICT');
}

/** POL-038: 재시도로 같은 id 가 다시 오면 DB 가 23505 로 거절한다 */
export const isUniqueViolation = (e: { code?: string } | null | undefined) => e?.code === '23505';

export const nowIso = () => new Date().toISOString();

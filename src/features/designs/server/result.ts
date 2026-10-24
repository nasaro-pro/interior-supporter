// B 액션 공통: DB 오류 → ActionResult (mapDbError + ref 로그), zod 실패 → VALIDATION_FAILED
import 'server-only';
import { z } from 'zod';
import { fail, mapDbError, type ActionResult } from '@/shared/contracts/errors';
import { logger, newRef, type LogFields } from '@/shared/lib/logger';

export function dbFail(
  msg: string,
  error: { code?: string; message?: string },
  fields: LogFields = {},
): ActionResult<never> {
  const ref = newRef();
  logger.warn(msg, { ...fields, ref, dbCode: error.code });
  return fail(mapDbError(error), { ref });
}

export function invalid(error: z.ZodError): ActionResult<never> {
  return fail('VALIDATION_FAILED', {
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  });
}

/** 낙관적 잠금 update 가 0행일 때 다시 읽은 대상 상태 */
export interface LockedRowState {
  version: number;
  archived_at: string | null;
}
type Lookup = {
  data: LockedRowState | null;
  error: { code?: string; message?: string } | null;
};

/**
 * B-08: 0행 update 의 원인을 구분한다 (모두 VERSION_CONFLICT 로 뭉뚱그리지 않는다)
 * - 행이 없거나 볼 수 없음 → NOT_FOUND (존재 비노출)
 * - 보관된 대상인데 보관 상태에서 허용하지 않는 변경 → CONFLICT (B-06)
 * - 버전이 다름 → VERSION_CONFLICT (최신 불러오기)
 * - 그 외(보이지만 바꿀 수 없음 = RLS update 거부) → NOT_FOUND
 * lookup: 같은 대상(id + project_id)을 `version, archived_at` 으로 다시 읽는 질의
 */
export async function explainNoRow(
  lookup: PromiseLike<Lookup>,
  baseVersion: number,
  opts: { rejectArchived: boolean; msg: string; fields?: LogFields },
): Promise<ActionResult<never>> {
  const { data, error } = await lookup;
  if (error) return dbFail(opts.msg, error, opts.fields);
  if (!data) return fail('NOT_FOUND');
  if (opts.rejectArchived && data.archived_at) return fail('CONFLICT');
  if (data.version !== baseVersion) return fail('VERSION_CONFLICT');
  return fail('NOT_FOUND');
}

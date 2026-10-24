// src/shared/lib/action.ts (A · TASK-001) — Server Action 공통 도우미 (03 문서 5.1 표준 형태를 줄여 쓰기)
import 'server-only';
import type { ZodError, ZodType } from 'zod';
import { fail, mapDbError, type ActionResult, type ErrorCode } from '@/shared/contracts/errors';
import { logger, newRef, type LogFields } from '@/shared/lib/logger';

/**
 * zod 오류 → fieldErrors. 메시지는 messages/<locale>/errors.json 의 field.* 키로 쓴다.
 * 스키마에서 `{ message: 'field.tooLong' }` 처럼 키를 지정하지 않은 경우 기본 'field.invalid'.
 */
export function toFieldErrors(error: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.length ? issue.path.join('.') : '_form';
    const key = issue.message.startsWith('field.') ? issue.message : 'field.invalid';
    (out[path] ??= []).push(key);
  }
  return out;
}

export type Parsed<T> = { ok: true; data: T } | { ok: false; result: ActionResult<never> };

/** 서버 입력 검증 — 실패 시 VALIDATION_FAILED + fieldErrors */
export function parseInput<T>(schema: ZodType<T>, raw: unknown): Parsed<T> {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    result: fail('VALIDATION_FAILED', { fieldErrors: toFieldErrors(parsed.error) }),
  };
}

/** DB 오류 → ActionResult (ref 를 남기고 warn 로그). 원문 메시지는 사용자에게 보내지 않는다 */
export function dbFail(
  msg: string,
  error: { code?: string; message?: string },
  fields: LogFields = {},
): ActionResult<never> {
  const ref = newRef();
  const code: ErrorCode = mapDbError(error);
  logger.warn(msg, { ...fields, ref, dbCode: error.code, code });
  return fail(code, { ref });
}

/** FormData → 평범한 객체 (같은 이름이 여러 번이면 마지막 값). 체크박스는 'on' 문자열 */
export function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === 'string') out[key] = value;
  });
  return out;
}

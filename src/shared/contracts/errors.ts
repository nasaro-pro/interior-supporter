/**
 * 오류·결과 계약 (IF-action-result) — 모든 Server Action / Route Handler 가 따른다.
 * 소유: A · docs/03_아키텍처_데이터_보안.md 2장
 */

export const ERROR_CODES = [
  'UNAUTHENTICATED', // 로그인 필요 / 세션 만료
  'FORBIDDEN', // 권한 없음 (존재 여부를 숨겨야 할 때는 NOT_FOUND 사용)
  'NOT_FOUND', // 없음 또는 볼 수 없음
  'VALIDATION_FAILED', // 입력 검증 실패 (fieldErrors 포함)
  'VERSION_CONFLICT', // 낙관적 잠금 실패 — 최신 내용 다시 불러오기 안내
  'STALE_REVISION', // 확정 대상이 바뀜 — 다시 확인 후 확정
  'ALREADY_CONFIRMED',
  'FILE_TYPE_REJECTED',
  'FILE_TOO_LARGE',
  'FILE_CORRUPT', // 형식 헤더·이미지 디코딩 실패
  'FILE_NOT_READY',
  'INVITE_INVALID', // 없음·만료·폐기 (구분해서 노출하지 않음)
  'INVITE_USED',
  'INVITE_EMAIL_MISMATCH',
  'SLUG_TAKEN',
  'RATE_LIMITED',
  'CONFLICT', // 일반 중복
  'INTERNAL', // 예상 못 한 오류 (상세는 서버 로그에만)
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface AppError {
  code: ErrorCode;
  /** 필드별 오류 메시지 키 (messages/<locale>/errors.json 의 field.* 키) */
  fieldErrors?: Record<string, string[]>;
  /** 서버 로그 상관관계 ID. 사용자에게 "문의 시 코드" 로만 표시 */
  ref?: string;
}

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: AppError };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (code: ErrorCode, extra?: Omit<AppError, 'code'>): ActionResult<never> => ({
  ok: false,
  error: { code, ...extra },
});

/** 화면 표시용 메시지 키: t(`errors.${code}`) */
export const errorMessageKey = (code: ErrorCode) => `errors.${code}` as const;

/**
 * DB(PostgREST) 오류 → ErrorCode 매핑. 마이그레이션의 raise exception 메시지가 원본이다.
 * Supabase 오류 객체: { code: '42501' | 'P0001' | '23505' | '23514' | 'PGRST116' ..., message }
 */
const DB_MESSAGE_MAP: Record<string, ErrorCode> = {
  forbidden: 'FORBIDDEN',
  project_not_found: 'NOT_FOUND',
  stale_revision: 'STALE_REVISION',
  already_confirmed: 'ALREADY_CONFIRMED',
  not_confirmed: 'CONFLICT',
  reason_required: 'VALIDATION_FAILED',
  invalid_target: 'VALIDATION_FAILED',
  archived: 'CONFLICT',
  file_not_found: 'NOT_FOUND',
  file_not_ready: 'FILE_NOT_READY',
  file_already_attached: 'CONFLICT',
  file_scope_mismatch: 'FORBIDDEN',
  file_kind_mismatch: 'FILE_TYPE_REJECTED',
  file_not_owned: 'FORBIDDEN',
  scope_mismatch: 'FORBIDDEN',
  invite_not_found: 'INVITE_INVALID',
  invite_expired: 'INVITE_INVALID',
  invite_revoked: 'INVITE_INVALID',
  invite_used: 'INVITE_USED',
  invite_email_mismatch: 'INVITE_EMAIL_MISMATCH',
  slug_taken: 'SLUG_TAKEN',
  owner_role_locked: 'FORBIDDEN',
  pm_must_be_member: 'VALIDATION_FAILED',
};

export function mapDbError(e: { code?: string; message?: string } | null | undefined): ErrorCode {
  if (!e) return 'INTERNAL';
  const msg = (e.message ?? '').trim();
  if (e.code === 'P0001') {
    if (msg.startsWith('immutable_column:') || msg.startsWith('system_column:')) return 'FORBIDDEN';
    return DB_MESSAGE_MAP[msg] ?? 'INTERNAL';
  }
  switch (e.code) {
    case '42501':
      return 'FORBIDDEN'; // RLS 위반
    case '23505':
      return 'CONFLICT'; // unique
    case '23514':
      return 'VALIDATION_FAILED'; // check
    case '23503':
      return 'VALIDATION_FAILED'; // fk
    case '22P02':
      return 'VALIDATION_FAILED'; // 잘못된 uuid 등
    case 'PGRST116':
      return 'NOT_FOUND'; // .single() 0행
    default:
      return 'INTERNAL';
  }
}

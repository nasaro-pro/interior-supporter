// src/features/admin/lib/anonymize.ts — 익명화·탈퇴 때 Auth 계정에 넣을 값 (A5·A10)
// DB 쪽 이름·연락처 익명화는 private.anonymize_user 가 한다. 여기는 Auth 이메일만 바꿔
// 같은 이메일로 다시 가입할 수 있게 하고, 원래 이메일이 남지 않게 한다.

/** 다시 쓰일 일 없는 이메일 (예약 도메인 .invalid — RFC 2606) */
export function anonymizedEmail(userId: string): string {
  return `deleted+${userId}@anonymized.invalid`;
}

/** 로그인 차단 기간. Auth 관리자 API 의 ban_duration 형식 (사실상 영구) */
export const PERMANENT_BAN = '876000h';
/** 정지 해제 */
export const NO_BAN = 'none';

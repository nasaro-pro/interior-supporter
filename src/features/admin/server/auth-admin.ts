// src/features/admin/server/auth-admin.ts — Auth·Storage 관리자 API (service_role). eslint 허용 목록 (CR-3)
// DB 상태 변경(정지 표시·익명화·기록)은 관리자 RPC 가 하고, 여기서는 DB 로 할 수 없는 Auth·Storage 쪽만 한다.
// 호출 전에 반드시 관리자 또는 본인 확인을 끝낸다 — 이 파일은 권한 검사를 하지 않는다.
import 'server-only';
import { createAdminSupabase } from '@/shared/lib/supabase/admin';
import { anonymizedEmail, NO_BAN, PERMANENT_BAN } from '../lib/anonymize';

export type AuthAdminResult = { ok: true } | { ok: false; code?: string };

/** 정지 = 로그인 차단 (기존 세션은 다음 토큰 갱신 때 끊긴다) */
export async function setLoginBlocked(userId: string, blocked: boolean): Promise<AuthAdminResult> {
  const { error } = await createAdminSupabase().auth.admin.updateUserById(userId, {
    ban_duration: blocked ? PERMANENT_BAN : NO_BAN,
  });
  return error ? { ok: false, code: error.code } : { ok: true };
}

/** 익명화·탈퇴: 이메일을 바꾸고 로그인을 막는다 (계정 행은 남겨 자료 작성자 연결을 지킨다) */
export async function anonymizeAuthUser(userId: string): Promise<AuthAdminResult> {
  const { error } = await createAdminSupabase().auth.admin.updateUserById(userId, {
    email: anonymizedEmail(userId),
    email_confirm: true,
    user_metadata: { display_name: null },
    ban_duration: PERMANENT_BAN,
  });
  return error ? { ok: false, code: error.code } : { ok: true };
}

/** 비밀번호 재설정용 1회 토큰 (링크 주소는 호출부가 core 의 재설정 링크와 같은 형식으로 만든다) */
export async function createRecoveryToken(
  userId: string,
): Promise<{ ok: true; hashedToken: string } | { ok: false; code?: string }> {
  const admin = createAdminSupabase();
  const user = await admin.auth.admin.getUserById(userId);
  const email = user.data.user?.email;
  if (!email) return { ok: false, code: 'user_not_found' };
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
  const hashedToken = data?.properties?.hashed_token;
  return error || !hashedToken ? { ok: false, code: error?.code } : { ok: true, hashedToken };
}

/** 정리 대상 파일의 저장소 객체 삭제 (버킷별 경로 묶음) */
export async function removeStorageObjects(
  byBucket: Map<string, string[]>,
): Promise<AuthAdminResult> {
  const storage = createAdminSupabase().storage;
  for (const [bucket, paths] of byBucket) {
    const { error } = await storage.from(bucket).remove(paths);
    if (error) return { ok: false, code: error.name };
  }
  return { ok: true };
}

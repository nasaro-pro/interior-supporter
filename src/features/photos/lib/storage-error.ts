// 서명 URL 업로드 실패 판정 (C-07) — 재시도 때 "이미 올라간 객체" 만 통과시킨다. 순수 함수.
// Supabase StorageApiError: status(number) · statusCode(string, 예: '409') · message('The resource already exists').
// 메시지 정규식 /exist/ 는 "does not exist"(버킷·객체 없음)까지 통과시키므로 쓰지 않는다.

const ALREADY_EXISTS = /\balready exists\b|^duplicate$/i;

export function isAlreadyExistsError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { status?: unknown; statusCode?: unknown; message?: unknown; error?: unknown };
  if (e.status === 409 || e.statusCode === '409' || e.statusCode === 409) return true;
  // 상태 코드가 없는 오류(구버전 클라이언트 등)만 문구로 보조 판정 — "already exists" · "Duplicate" 만
  if (e.status !== undefined || e.statusCode !== undefined) return false;
  return [e.message, e.error].some((v) => typeof v === 'string' && ALREADY_EXISTS.test(v.trim()));
}

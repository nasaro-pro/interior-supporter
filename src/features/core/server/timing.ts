// src/features/core/server/timing.ts (A · A-03) — 실패 응답 시간 평준화 (server-only)
// 가입·초대 신규 계정의 실패 경로는 "이미 있는 이메일(422, 빠름)"과 "기타 오류/보상 삭제(느림)"의
// 응답 시간이 달라 존재 여부가 드러날 수 있다. 실패 응답은 요청 시작부터 최소 FAILURE_MIN_MS
// (+0~FAILURE_JITTER_MS 무작위)가 지난 뒤에 돌려준다. 이미 더 오래 걸렸으면 추가 대기 없음.
// 한계: 단일 인스턴스 메모리 대기라 네트워크 지터 수준의 차이는 남는다 — 요청 제한(SIGNUP_RATE_LIMIT)이 2차 방어선.
import 'server-only';

export const FAILURE_MIN_MS = 700;
export const FAILURE_JITTER_MS = 150;

/** 남은 대기 시간(ms) — 순수 함수 (테스트 대상) */
export function remainingDelay(
  startedAt: number,
  now: number,
  random: number,
  minMs = FAILURE_MIN_MS,
  jitterMs = FAILURE_JITTER_MS,
): number {
  const target = minMs + Math.floor(Math.max(0, Math.min(1, random)) * jitterMs);
  return Math.max(0, target - (now - startedAt));
}

/** 요청 시작 시각(startedAt) 기준으로 실패 응답 시간을 맞춘다 */
export async function levelFailureTiming(startedAt: number): Promise<void> {
  const wait = remainingDelay(startedAt, Date.now(), Math.random());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

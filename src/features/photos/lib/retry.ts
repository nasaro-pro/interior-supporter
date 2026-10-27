// 자동 재시도 (통합본 7장 F6) — 일시적 실패만 정해진 간격으로 다시 시도. 순수 로직, 기다리기는 주입

export const AUTO_RETRY_DELAYS_MS = [1000, 3000] as const;

export interface RetryOptions<T> {
  /** 다시 시도할 결과인가 (예: 네트워크 실패). 예외는 항상 일시적 실패로 본다 */
  shouldRetry(result: T): boolean;
  delays?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  /** 다시 시도하기 직전 알림 (1부터) */
  onRetry?: (attempt: number) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 첫 시도 + delays 길이만큼 재시도. 마지막 시도의 예외는 그대로 던진다 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions<T>): Promise<T> {
  const delays = opts.delays ?? AUTO_RETRY_DELAYS_MS;
  const sleep = opts.sleep ?? defaultSleep;
  for (let attempt = 0; ; attempt++) {
    const last = attempt >= delays.length;
    try {
      const result = await fn();
      if (last || !opts.shouldRetry(result)) return result;
    } catch (e) {
      if (last) throw e;
    }
    opts.onRetry?.(attempt + 1);
    await sleep(delays[attempt]!);
  }
}

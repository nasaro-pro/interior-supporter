// A-03: 실패 응답 시간 평준화 — 요청 시작부터 최소 시간(+지터)까지 기다린다
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FAILURE_JITTER_MS,
  FAILURE_MIN_MS,
  levelFailureTiming,
  remainingDelay,
} from './server/timing';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('A-03 remainingDelay', () => {
  it('정상: 빠른 실패(422)와 느린 실패는 같은 목표 시각까지 맞춘다', () => {
    const fast = remainingDelay(0, 50, 0); // 50ms 만에 실패
    const slow = remainingDelay(0, 400, 0); // 400ms 만에 실패
    expect(50 + fast).toBe(FAILURE_MIN_MS);
    expect(400 + slow).toBe(FAILURE_MIN_MS);
  });

  it('지터는 0~FAILURE_JITTER_MS, 범위 밖 random 은 잘라낸다', () => {
    expect(remainingDelay(0, 0, 1)).toBe(FAILURE_MIN_MS + FAILURE_JITTER_MS);
    expect(remainingDelay(0, 0, 5)).toBe(FAILURE_MIN_MS + FAILURE_JITTER_MS);
    expect(remainingDelay(0, 0, -1)).toBe(FAILURE_MIN_MS);
  });

  it('예외: 이미 목표보다 오래 걸렸으면 추가 대기 없음', () => {
    expect(remainingDelay(0, 5000, 0.5)).toBe(0);
  });
});

describe('A-03 levelFailureTiming', () => {
  it('목표 시각 전에는 끝나지 않는다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    let done = false;
    const p = levelFailureTiming(10_000).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(FAILURE_MIN_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
  });

  it('이미 오래 걸린 요청은 바로 끝난다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    let done = false;
    const p = levelFailureTiming(0).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    await p;
    expect(done).toBe(true);
  });
});

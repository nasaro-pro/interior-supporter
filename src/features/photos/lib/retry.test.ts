import { describe, expect, it, vi } from 'vitest';
import { withRetry } from './retry';

const sleep = vi.fn(async () => {});

describe('withRetry (F6)', () => {
  it('성공하면 한 번만', async () => {
    const fn = vi.fn(async () => 'ok');
    expect(await withRetry(fn, { shouldRetry: () => false, sleep })).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('일시적 실패·예외는 간격을 두고 다시, 성공하면 멈춘다', async () => {
    // 1회차 예외 → 2회차 'fail'(일시적) → 3회차 'ok'
    const steps: (() => string)[] = [
      () => {
        throw new Error('net');
      },
      () => 'fail',
      () => 'ok',
    ];
    let n = 0;
    const fn = vi.fn(async () => steps[n++]!());
    const onRetry = vi.fn();
    const out = await withRetry(fn, {
      shouldRetry: (r) => r === 'fail',
      delays: [10, 20, 30],
      sleep,
      onRetry,
    });
    expect(out).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry.mock.calls).toEqual([[1], [2]]);
  });

  it('횟수를 다 쓰면 마지막 결과(또는 예외)를 돌려준다', async () => {
    expect(
      await withRetry(async () => 'fail', { shouldRetry: () => true, delays: [1], sleep }),
    ).toBe('fail');
    await expect(
      withRetry(
        async () => {
          throw new Error('net');
        },
        { shouldRetry: () => true, delays: [1], sleep },
      ),
    ).rejects.toThrow('net');
  });
});

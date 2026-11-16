// 2026-11 구성원 표 — 포트폴리오 권한 3칸 버튼: 고른 칸 표시 · 누르면 저장 · 방향키 이동 · 실패하면 그대로
import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const setPortfolioAccess = vi.fn();
vi.mock('../server/permission-actions', () => ({
  setPortfolioAccess: (...a: unknown[]) => setPortfolioAccess(...a),
  decidePortfolioAccess: vi.fn(),
  requestPortfolioAccess: vi.fn(),
}));

import { PortfolioAccessSelect } from './permission';

const read = (ns: string) => JSON.parse(readFileSync(`messages/ko/${ns}.json`, 'utf8'));
const messages = { common: read('common'), errors: read('errors'), portfolio: read('portfolio') };
const CO = '00000000-0000-4000-8000-0000000000c1';
const M = '00000000-0000-4000-8000-000000000002';
const ui = () =>
  render(
    <NextIntlClientProvider locale="ko" messages={messages}>
      <PortfolioAccessSelect companyId={CO} memberId={M} level="none" name="박디자이너" />
    </NextIntlClientProvider>,
  );
const radios = () => [...document.querySelectorAll<HTMLElement>('[role="radio"]')];
afterEach(() => {
  cleanup();
  setPortfolioAccess.mockReset();
});

describe('PortfolioAccessSelect (3칸 버튼)', () => {
  it('지금 단계가 선택돼 있고, 누르면 그 단계로 저장', async () => {
    setPortfolioAccess.mockResolvedValueOnce({ ok: true, data: null });
    ui();
    expect(radios().map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    await act(async () => {
      fireEvent.click(radios()[1]!);
    });
    expect(setPortfolioAccess).toHaveBeenCalledWith({ companyId: CO, memberId: M, level: 'works' });
    expect(radios()[1]?.getAttribute('aria-checked')).toBe('true');
  });

  it('방향키로도 바꾸고, 실패하면 원래 값 그대로', async () => {
    setPortfolioAccess.mockResolvedValueOnce({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'x' },
    });
    ui();
    await act(async () => {
      fireEvent.keyDown(radios()[0]!, { key: 'ArrowRight' });
    });
    expect(setPortfolioAccess).toHaveBeenCalledWith(expect.objectContaining({ level: 'works' }));
    expect(radios()[0]?.getAttribute('aria-checked')).toBe('true');
  });
});

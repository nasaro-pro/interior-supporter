import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortfolioSlideshow, SLIDE_INTERVAL_MS, type Slide } from './PortfolioSlideshow';

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
const portfolio = JSON.parse(readFileSync('messages/ko/portfolio.json', 'utf8'));
const p = portfolio;
const img = {
  path: 'c/w/1.webp',
  thumbPath: 'c/w/1_t.webp',
  width: 2000,
  height: 1500,
  caption: '',
};
const slides: Slide[] = ['청담동 32평', '반포동 주방', '압구정동 34평'].map((title, i) => ({
  id: `s${i}`,
  title,
  href: `/c/k/works/s${i}`,
  image: img,
}));

let reduced = false;
beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('reduce') ? reduced : false,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const wrap = () =>
  render(
    <NextIntlClientProvider locale="ko" messages={{ portfolio }}>
      <PortfolioSlideshow slides={slides} />
    </NextIntlClientProvider>,
  );
const activeTitle = () => screen.getByRole('link', { name: /자세히 보기/ }).textContent;
const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('PortfolioSlideshow', () => {
  it('7초마다 다음 사진으로, 끝에서 처음으로', () => {
    wrap();
    expect(activeTitle()).toContain('청담동 32평');
    tick(SLIDE_INTERVAL_MS);
    expect(activeTitle()).toContain('반포동 주방');
    tick(SLIDE_INTERVAL_MS * 2);
    expect(activeTitle()).toContain('청담동 32평');
  });

  it('보이는 사진만 화면 읽기에 노출, 사진 이름 링크는 그 사례 상세로', () => {
    wrap();
    const groups = screen.getAllByTestId('portfolio-slide');
    expect(groups.map((g) => g.getAttribute('aria-hidden'))).toEqual(['false', 'true', 'true']);
    expect(screen.getByRole('link', { name: /자세히 보기/ })).toHaveAttribute(
      'href',
      '/c/k/works/s0',
    );
  });

  it('멈춤 버튼을 누르면 넘어가지 않고, 다시 누르면 재생', () => {
    wrap();
    fireEvent.click(screen.getByRole('button', { name: p.slideshow.pause }));
    tick(SLIDE_INTERVAL_MS * 3);
    expect(activeTitle()).toContain('청담동 32평');
    fireEvent.click(screen.getByRole('button', { name: p.slideshow.play }));
    tick(SLIDE_INTERVAL_MS);
    expect(activeTitle()).toContain('반포동 주방');
  });

  it('마우스를 올리면 잠시 멈추고, 떼면 다시', () => {
    wrap();
    const section = screen.getByRole('region', { name: p.slideshow.label });
    fireEvent.mouseEnter(section);
    tick(SLIDE_INTERVAL_MS * 2);
    expect(activeTitle()).toContain('청담동 32평');
    fireEvent.mouseLeave(section);
    tick(SLIDE_INTERVAL_MS);
    expect(activeTitle()).toContain('반포동 주방');
  });

  it('점·이전·다음으로 직접 이동', () => {
    wrap();
    fireEvent.click(screen.getByRole('button', { name: /3번째 사진/ }));
    expect(activeTitle()).toContain('압구정동 34평');
    fireEvent.click(screen.getByRole('button', { name: p.public.next }));
    expect(activeTitle()).toContain('청담동 32평');
  });

  it('운영체제 동작 줄이기면 자동으로 넘기지 않는다', () => {
    reduced = true;
    wrap();
    tick(SLIDE_INTERVAL_MS * 3);
    expect(activeTitle()).toContain('청담동 32평');
  });

  it('사진이 1장이면 버튼·점 없이 사진만', () => {
    render(
      <NextIntlClientProvider locale="ko" messages={{ portfolio }}>
        <PortfolioSlideshow slides={slides.slice(0, 1)} />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});

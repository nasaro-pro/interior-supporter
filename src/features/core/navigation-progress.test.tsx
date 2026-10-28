// 페이지 이동 표시줄 (성능 개선 ①): 사이트 안 링크 클릭 때만 켜지고, 주소가 바뀌면 꺼진다
// next/link 도 결국 <a> 로 그려지고 컴포넌트는 모든 <a> 클릭을 보므로, 라우터 없이 맨 <a> 로 시험한다
/* eslint-disable @next/next/no-html-link-for-pages */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ pathname: '/app/studio-x/projects', search: '' }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

import { NavigationProgress } from './components/navigation-progress';

const bar = () => document.querySelector('[data-ui-key="navigation-progress"]')!;

function setup(links: React.ReactNode) {
  window.history.replaceState(null, '', nav.pathname + (nav.search ? `?${nav.search}` : ''));
  const view = render(
    <>
      <NavigationProgress />
      {links}
    </>,
  );
  // 실제 이동은 막는다 (jsdom 은 이동하지 않지만 next/link 처럼 기본 동작 취소)
  document.addEventListener('click', preventNavigation);
  return view;
}
const preventNavigation = (e: MouseEvent) => e.preventDefault();

describe('NavigationProgress', () => {
  beforeEach(() => {
    nav.pathname = '/app/studio-x/projects';
    nav.search = '';
  });
  afterEach(() => {
    cleanup();
    document.removeEventListener('click', preventNavigation);
    vi.useRealTimers();
  });

  it('사이트 안 다른 화면 링크를 누르면 켜지고, 주소가 바뀌면 꺼진다', () => {
    const view = setup(<a href="/app/studio-x/clients">고객</a>);
    expect(bar().getAttribute('data-state')).toBe('idle');
    fireEvent.click(screen.getByText('고객'));
    expect(bar().getAttribute('data-state')).toBe('loading');

    nav.pathname = '/app/studio-x/clients';
    view.rerender(
      <>
        <NavigationProgress />
        <a href="/app/studio-x/clients">고객</a>
      </>,
    );
    expect(bar().getAttribute('data-state')).toBe('idle');
  });

  it('검색 조건(쿼리)만 바뀌는 링크도 이동으로 본다', () => {
    setup(<a href="/app/studio-x/projects?status=active">진행 중</a>);
    fireEvent.click(screen.getByText('진행 중'));
    expect(bar().getAttribute('data-state')).toBe('loading');
  });

  it('링크 안 아이콘·글자를 눌러도 켜진다', () => {
    setup(
      <a href="/app/studio-x/history">
        <span>이력</span>
      </a>,
    );
    fireEvent.click(screen.getByText('이력'));
    expect(bar().getAttribute('data-state')).toBe('loading');
  });

  it.each([
    [
      '새 탭',
      <a key="a" href="/app/studio-x/clients" target="_blank">
        링크
      </a>,
      {},
    ],
    [
      'Ctrl 클릭',
      <a key="a" href="/app/studio-x/clients">
        링크
      </a>,
      { ctrlKey: true },
    ],
    [
      'Cmd 클릭',
      <a key="a" href="/app/studio-x/clients">
        링크
      </a>,
      { metaKey: true },
    ],
    [
      '가운데 버튼',
      <a key="a" href="/app/studio-x/clients">
        링크
      </a>,
      { button: 1 },
    ],
    [
      '외부 사이트',
      <a key="a" href="https://example.com/x">
        링크
      </a>,
      {},
    ],
    [
      '다운로드',
      <a key="a" href="/app/studio-x/clients" download>
        링크
      </a>,
      {},
    ],
    [
      '파일 API',
      <a key="a" href="/api/files/1">
        링크
      </a>,
      {},
    ],
    [
      '같은 화면',
      <a key="a" href="/app/studio-x/projects">
        링크
      </a>,
      {},
    ],
    [
      '같은 화면 해시',
      <a key="a" href="/app/studio-x/projects#top">
        링크
      </a>,
      {},
    ],
  ])('%s 은(는) 켜지지 않는다', (_label, link, init) => {
    setup(link);
    fireEvent.click(screen.getByText('링크'), init);
    expect(bar().getAttribute('data-state')).toBe('idle');
  });

  it('링크가 아닌 버튼은 켜지지 않는다', () => {
    setup(<button type="button">저장</button>);
    fireEvent.click(screen.getByText('저장'));
    expect(bar().getAttribute('data-state')).toBe('idle');
  });

  it('이동이 끝나지 않으면 15초 뒤 스스로 꺼진다', () => {
    vi.useFakeTimers();
    setup(<a href="/app/studio-x/clients">고객</a>);
    fireEvent.click(screen.getByText('고객'));
    expect(bar().getAttribute('data-state')).toBe('loading');
    act(() => vi.advanceTimersByTime(14_000));
    expect(bar().getAttribute('data-state')).toBe('loading');
    act(() => vi.advanceTimersByTime(1_000));
    expect(bar().getAttribute('data-state')).toBe('idle');
  });

  it('화면 읽기 프로그램에는 숨긴다 (로딩 안내는 각 화면 뼈대가 한다)', () => {
    setup(null);
    expect(bar().getAttribute('aria-hidden')).toBe('true');
  });
});

'use client';
// 페이지 이동 표시줄 — 사이트 안 링크를 누른 순간부터 새 화면 주소로 바뀔 때까지 맨 위 진행 막대.
// 서버 응답(상태 코드)에는 손대지 않는다: 페이지에서 404 를 내는 상세 화면처럼 loading.tsx 를 둘 수 없는 곳도 바로 반응이 보이게
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib/utils';

/** 이동이 끝나지 않으면(같은 주소로 돌아옴·오류) 막대를 거둔다 */
const GIVE_UP_MS = 15_000;

/** 새 화면으로 가는 사이트 안 링크 클릭인가 — 새 탭·다운로드·외부·같은 주소(해시만 다름)는 제외 */
export function isInternalNavigation(e: MouseEvent): boolean {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const a = (e.target as Element | null)?.closest?.('a');
  if (!a || !a.href || a.hasAttribute('download')) return false;
  if (a.target && a.target !== '_self') return false;
  const next = new URL(a.href, window.location.href);
  if (next.origin !== window.location.origin || next.pathname.startsWith('/api/')) return false;
  return next.pathname !== window.location.pathname || next.search !== window.location.search;
}

export function NavigationProgress() {
  const routeKey = `${usePathname()}?${useSearchParams().toString()}`;
  const routeRef = useRef(routeKey);
  // 누른 시점의 화면 — 주소가 바뀌면 자동으로 loading 이 풀린다 (effect 에서 setState 하지 않음)
  const [startedOn, setStartedOn] = useState<string | null>(null);
  const loading = startedOn !== null && startedOn === routeKey;

  useEffect(() => {
    routeRef.current = routeKey;
  }, [routeKey]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    // capture: next/link 가 기본 동작을 막기 전에 본다
    const onClick = (e: MouseEvent) => {
      if (!isInternalNavigation(e)) return;
      const from = routeRef.current;
      setStartedOn(from);
      clearTimeout(timer);
      timer = setTimeout(() => setStartedOn((s) => (s === from ? null : s)), GIVE_UP_MS);
    };
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      data-ui-key="navigation-progress"
      data-state={loading ? 'loading' : 'idle'}
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 transition-opacity',
        loading ? 'opacity-100 delay-150 duration-200' : 'opacity-0 duration-300',
      )}
    >
      <div className="bg-primary h-full w-full motion-safe:animate-pulse" />
    </div>
  );
}

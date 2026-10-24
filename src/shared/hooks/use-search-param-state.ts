'use client';
// src/shared/hooks/use-search-param-state.ts (A) — 화면 상태(폼 열기 등)를 query 로 표현 (02 문서 4장: ?mode=new|edit — 새 뎁스 아님)
// 직접 URL·새로고침·뒤로가기에서도 같은 상태가 복원된다. 다른 query(필터 등)는 그대로 둔다
import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function useSearchParamState(
  key: string,
  { history = 'replace' }: { history?: 'replace' | 'push' } = {},
): [string | null, (value: string | null) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get(key);
  const set = useCallback(
    (next: string | null) => {
      const copy = new URLSearchParams(params.toString());
      if (next === null || next === '') copy.delete(key);
      else copy.set(key, next);
      const qs = copy.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      if (history === 'push') router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [history, key, params, pathname, router],
  );
  return [value, set];
}

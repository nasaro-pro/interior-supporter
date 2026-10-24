// P3 UI 표준 — useSearchParamState: ?mode= 화면 상태, 다른 query 유지, 값 지우기, push 옵션
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
const push = vi.fn();
let search = 'status=open';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => '/app/c/projects/p/requests',
  useSearchParams: () => new URLSearchParams(search),
}));

import { useSearchParamState } from './use-search-param-state';

beforeEach(() => {
  replace.mockReset();
  push.mockReset();
  search = 'status=open';
});

describe('useSearchParamState', () => {
  it('현재 값을 읽고, 설정하면 다른 query 를 유지해 replace(scroll:false)', () => {
    search = 'status=open&mode=edit';
    const { result } = renderHook(() => useSearchParamState('mode'));
    expect(result.current[0]).toBe('edit');
    act(() => result.current[1]('new'));
    expect(replace).toHaveBeenCalledWith('/app/c/projects/p/requests?status=open&mode=new', {
      scroll: false,
    });
  });
  it('null 이면 키를 지우고, 남은 query 가 없으면 경로만', () => {
    search = 'mode=new';
    const { result } = renderHook(() => useSearchParamState('mode'));
    act(() => result.current[1](null));
    expect(replace).toHaveBeenCalledWith('/app/c/projects/p/requests', { scroll: false });
  });
  it('history: push 옵션', () => {
    const { result } = renderHook(() => useSearchParamState('mode', { history: 'push' }));
    expect(result.current[0]).toBeNull();
    act(() => result.current[1]('new'));
    expect(push).toHaveBeenCalledWith('/app/c/projects/p/requests?status=open&mode=new', {
      scroll: false,
    });
  });
});

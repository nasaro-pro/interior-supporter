// P3 UI 표준 — ActionError(충돌 시 최신 불러오기) · useActionErrorText · RouteError(재시도·문의 코드)
import { cleanup, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { ActionError, isConflictCode, useActionErrorText } from './action-error';
import { RouteError } from './route-error';
import { koMessages, renderIntl } from './test-intl';

afterEach(cleanup);
beforeEach(() => refresh.mockReset());

describe('ActionError', () => {
  it('충돌 코드 판정', () => {
    expect(isConflictCode('VERSION_CONFLICT')).toBe(true);
    expect(isConflictCode('STALE_REVISION')).toBe(true);
    expect(isConflictCode('CONFLICT')).toBe(true);
    expect(isConflictCode('FORBIDDEN')).toBe(false);
  });

  it('error 가 없으면 아무것도 그리지 않는다', () => {
    const { container } = renderIntl(<ActionError error={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('일반 오류: role=alert 문구 + 문의 코드, 최신 불러오기 버튼 없음', () => {
    renderIntl(<ActionError error={{ code: 'FORBIDDEN', ref: 'abc123' }} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(koMessages.errors.FORBIDDEN);
    expect(alert).toHaveTextContent('abc123');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('VERSION_CONFLICT: [최신 내용 불러오기] → router.refresh + onReload', async () => {
    const onReload = vi.fn();
    renderIntl(<ActionError error={{ code: 'VERSION_CONFLICT' }} onReload={onReload} />);
    const btn = screen.getByRole('button', { name: koMessages.common.action.loadLatest });
    expect(btn).toHaveAttribute('data-ui-key', 'conflict-load-latest');
    await userEvent.click(btn);
    expect(refresh).toHaveBeenCalledOnce();
    expect(onReload).toHaveBeenCalledOnce();
  });

  it('useActionErrorText 는 "문구 (문의 코드)" 한 줄을 만든다', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NextIntlClientProvider locale="ko" messages={koMessages}>
        {children}
      </NextIntlClientProvider>
    );
    const { result } = renderHook(() => useActionErrorText(), { wrapper });
    expect(result.current({ code: 'INTERNAL' })).toBe(koMessages.errors.INTERNAL);
    expect(result.current({ code: 'INTERNAL', ref: 'r9' })).toContain('r9');
  });
});

describe('RouteError', () => {
  it('main[data-screen-id] 안에 오류·문의 코드(digest)·다시 시도(reset)', async () => {
    const reset = vi.fn();
    const error = Object.assign(new Error('boom'), { digest: 'dg-42' });
    const { container } = renderIntl(<RouteError error={error} reset={reset} screenId="PM-05" />);
    expect(container.querySelector('main')).toHaveAttribute('data-screen-id', 'PM-05');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(koMessages.common.state.error);
    expect(alert).toHaveTextContent('dg-42');
    expect(alert).not.toHaveTextContent('boom');
    await userEvent.click(screen.getByRole('button', { name: koMessages.common.action.retry }));
    expect(reset).toHaveBeenCalledOnce();
  });
});

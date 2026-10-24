// P3 디자인 통일 — C 화면이 A 표준 부품을 쓰면서도 E2E 가 쓰는 data-ui-key·접근성 속성을 유지하는지
import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
const push = vi.fn();
const replace = vi.fn();
let search = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push, replace }),
  usePathname: () => '/portal/projects/p1/requests',
  useSearchParams: () => search,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const setRequestArchived = vi.fn();
const createRequest = vi.fn();
vi.mock('../server/actions', () => ({
  setRequestArchived: (...a: unknown[]) => setRequestArchived(...a),
  createRequest: (...a: unknown[]) => createRequest(...a),
}));

import { RequestArchiveButton } from './RequestArchiveButton';
import { RequestCreateSheet } from './RequestCreateSheet';
import { RequestStatusBadge } from './RequestStatusBadge';

const read = (ns: string) => JSON.parse(readFileSync(`messages/ko/${ns}.json`, 'utf8'));
const messages = { common: read('common'), errors: read('errors'), requests: read('requests') };
const renderKo = (node: ReactNode) =>
  render(
    <NextIntlClientProvider locale="ko" messages={messages}>
      {node}
    </NextIntlClientProvider>,
  );
const byKey = (k: string) => document.querySelector<HTMLElement>(`[data-ui-key="${k}"]`);

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  search = new URLSearchParams();
});

describe('RequestArchiveButton', () => {
  it('보관: 트리거 request-archive → 확인 대화상자 → request-archive-confirm 으로 실행', async () => {
    setRequestArchived.mockResolvedValue({ ok: true, data: { version: 2 } });
    renderKo(<RequestArchiveButton projectId="p1" requestId="r1" version={1} archived={false} />);
    await userEvent.click(byKey('request-archive')!);
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveAttribute('data-ui-key', 'request-archive-dialog');
    await userEvent.click(byKey('request-archive-confirm')!);
    await waitFor(() =>
      expect(setRequestArchived).toHaveBeenCalledWith({
        projectId: 'p1',
        requestId: 'r1',
        baseVersion: 1,
        archived: true,
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('충돌이면 오류 문구(role=alert)와 [최신 내용 불러오기]', async () => {
    setRequestArchived.mockResolvedValue({ ok: false, error: { code: 'VERSION_CONFLICT' } });
    renderKo(<RequestArchiveButton projectId="p1" requestId="r1" version={1} archived />);
    await userEvent.click(byKey('request-restore')!);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(byKey('conflict-load-latest')).not.toBeNull();
  });
});

describe('RequestCreateSheet', () => {
  it('?mode=new 이면 Sheet 가 열리고, 빈 제출은 aria-invalid + role=alert', async () => {
    search = new URLSearchParams('mode=new');
    renderKo(<RequestCreateSheet projectId="p1" />);
    expect(await screen.findByRole('dialog')).toHaveAttribute(
      'data-ui-key',
      'request-create-sheet',
    );
    await userEvent.click(byKey('request-form-submit')!);
    const title = document.getElementById('request-title')!;
    await waitFor(() => expect(title).toHaveAttribute('aria-invalid', 'true'));
    expect(title.getAttribute('aria-describedby')).toContain('request-title-error');
    expect(document.getElementById('request-title-error')).toHaveAttribute('role', 'alert');
    expect(createRequest).not.toHaveBeenCalled();
  });

  it('입력 → 제출 확인(request-submit-confirm, 위험 강조 없음) → 생성 후 상세로 이동', async () => {
    search = new URLSearchParams('mode=new');
    createRequest.mockResolvedValue({ ok: true, data: { id: 'new-id' } });
    renderKo(<RequestCreateSheet projectId="p1" />);
    await userEvent.type(document.getElementById('request-title')!, '거실 조명');
    await userEvent.type(document.getElementById('request-body')!, '창가 쪽으로');
    await userEvent.click(byKey('request-form-submit')!);
    const confirm = await waitFor(() => byKey('request-submit-confirm')!);
    expect(confirm.className).toContain('bg-primary');
    expect(confirm.className).not.toContain('bg-destructive');
    await userEvent.click(confirm);
    await waitFor(() =>
      expect(createRequest).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'p1', title: '거실 조명', body: '창가 쪽으로' }),
      ),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith('/portal/projects/p1/requests/new-id'));
  });
});

describe('RequestStatusBadge', () => {
  it('02 문서 7.2 매핑: 처리 중 = caution 톤 + 라벨', () => {
    renderKo(<RequestStatusBadge status="in_progress" />);
    const badge = screen.getByText('처리 중');
    expect(badge.closest('[data-tone]')).toHaveAttribute('data-tone', 'caution');
  });
});

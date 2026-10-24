// P3 UI 표준 — ConfirmDialog: ① Server Action(트리거형) ② onConfirm 콜백(제어형) · 위험 강조 · ui-key 접미사
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
  },
}));

import { ConfirmDialog } from './confirm-dialog';
import { koMessages, renderIntl } from './test-intl';

afterEach(cleanup);
beforeEach(() => {
  refresh.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
});

const byKey = (k: string) => document.querySelector<HTMLElement>(`[data-ui-key="${k}"]`)!;

describe('ConfirmDialog', () => {
  it('① 트리거 + action 성공 → 닫힘·toast·refresh', async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, data: { version: 2 } });
    const onSuccess = vi.fn();
    renderIntl(
      <ConfirmDialog
        trigger="보관"
        uiKey="project-archive"
        title="보관할까요?"
        body="보관하면 보이지 않습니다."
        confirmLabel="보관"
        successMessage="보관했습니다."
        action={action}
        onSuccess={onSuccess}
      />,
    );
    await userEvent.click(byKey('project-archive'));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveAttribute('data-ui-key', 'project-archive-dialog');
    expect(byKey('project-archive-confirm').className).toContain('bg-destructive/10');
    await userEvent.click(byKey('project-archive-confirm'));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(action).toHaveBeenCalledOnce();
    expect(toastSuccess).toHaveBeenCalledWith('보관했습니다.');
    expect(onSuccess).toHaveBeenCalledWith({ version: 2 });
    expect(refresh).toHaveBeenCalled();
  });

  it('① action 충돌 실패 → 열린 채 오류 toast + refresh', async () => {
    const action = vi
      .fn()
      .mockResolvedValue({ ok: false, error: { code: 'VERSION_CONFLICT', ref: 'r1' } });
    renderIntl(
      <ConfirmDialog
        trigger="보관"
        uiKey="x"
        title="t"
        body="b"
        confirmLabel="확인"
        action={action}
      />,
    );
    await userEvent.click(byKey('x'));
    await userEvent.click(await waitFor(() => byKey('x-confirm')));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0]![0]).toBe(koMessages.errors.VERSION_CONFLICT);
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('② 제어형 + onConfirm 콜백, 트리거 없으면 패널 ui-key = uiKey, 취소 버튼 문구 기본값', async () => {
    const onConfirm = vi.fn();
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          uiKey="request-archive"
          destructive={false}
          title="보관할까요?"
          body={<strong>요약</strong>}
          confirmLabel="보관"
          onConfirm={() => {
            onConfirm();
            setOpen(false);
          }}
        />
      );
    }
    renderIntl(<Host />);
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveAttribute('data-ui-key', 'request-archive');
    expect(screen.getByText('요약')).toBeInTheDocument();
    expect(byKey('request-archive-cancel')).toHaveTextContent(koMessages.common.action.cancel);
    expect(byKey('request-archive-confirm').className).toMatch(/bg-primary/);
    await userEvent.click(byKey('request-archive-confirm'));
    expect(onConfirm).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('pending 이면 확인 버튼 비활성 + aria-busy', async () => {
    renderIntl(
      <ConfirmDialog
        open
        uiKey="p"
        title="t"
        body="b"
        confirmLabel="확인"
        onConfirm={() => {}}
        pending
      />,
    );
    await screen.findByRole('alertdialog');
    expect(byKey('p-confirm')).toBeDisabled();
    expect(byKey('p-confirm')).toHaveAttribute('aria-busy', 'true');
    expect(byKey('p-cancel')).toBeDisabled();
  });
});

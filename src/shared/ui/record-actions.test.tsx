// P3 UI 표준 — ArchiveToggle(보관은 확인, 복원은 즉시) · PublishToggle(role=switch, 공개 전 확인)
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

import { ArchiveToggle, PublishToggle } from './record-actions';
import { koMessages, renderIntl } from './test-intl';

afterEach(cleanup);
beforeEach(() => {
  refresh.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
});
const byKey = (k: string) => document.querySelector<HTMLElement>(`[data-ui-key="${k}"]`)!;
const c = koMessages.common;

describe('ArchiveToggle', () => {
  it('보관: 확인 대화상자 → action({...payload, archived:true}) → toast·refresh', async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, data: { version: 3 } });
    renderIntl(
      <ArchiveToggle
        action={action}
        payload={{ id: 'm1', baseVersion: 2 }}
        archived={false}
        uiKey="material-archive"
      />,
    );
    await userEvent.click(byKey('material-archive'));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(c.confirm.archive.title);
    await userEvent.click(byKey('material-archive-dialog-confirm'));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(c.toast.archived));
    expect(action).toHaveBeenCalledWith({ id: 'm1', baseVersion: 2, archived: true });
    expect(refresh).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('복원: 확인 없이 즉시, 충돌이면 오류 toast + refresh', async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, error: { code: 'VERSION_CONFLICT' } });
    renderIntl(<ArchiveToggle action={action} payload={{ id: 'm1' }} archived uiKey="a" />);
    await userEvent.click(screen.getByRole('button', { name: c.action.restore }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(action).toHaveBeenCalledWith({ id: 'm1', archived: false });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(refresh).toHaveBeenCalled();
  });
});

describe('PublishToggle', () => {
  it('role=switch·aria-checked, 공개 전 확인 후 isPublic:true', async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, data: {} });
    renderIntl(
      <PublishToggle
        action={action}
        payload={{ id: 'd1' }}
        isPublic={false}
        uiKey="design-publish"
        confirm={{ title: '공개할까요?', body: '고객에게 보입니다.' }}
      />,
    );
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw).toHaveTextContent(c.visibility.private);
    await userEvent.click(sw);
    await screen.findByRole('alertdialog');
    await userEvent.click(byKey('design-publish-dialog-confirm'));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(c.toast.published));
    expect(action).toHaveBeenCalledWith({ id: 'd1', isPublic: true });
  });

  it('공개 중이면 확인 없이 비공개로', async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, data: {} });
    renderIntl(
      <PublishToggle
        action={action}
        payload={{}}
        isPublic
        uiKey="p"
        confirm={{ title: 't', body: 'b' }}
      />,
    );
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(c.toast.unpublished));
    expect(action).toHaveBeenCalledWith({ isPublic: false });
  });
});

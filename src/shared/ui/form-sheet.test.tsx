// P3 UI 표준 — FormSheet: 트리거·제목·설명·footer·닫기(aria-label)·busy 시 닫힘 방지·제어형
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormSheet } from './form-sheet';
import { FormSheet as CoreFormSheet } from '@/features/core/components/form-sheet';
import { renderIntl } from './test-intl';

afterEach(cleanup);

describe('FormSheet', () => {
  it('core 경로는 같은 컴포넌트를 재수출한다 (기존 import 호환)', () => {
    expect(CoreFormSheet).toBe(FormSheet);
  });

  it('트리거로 열고, 제목·설명·본문·footer 를 그리며 닫기 버튼에 이름이 있다', async () => {
    renderIntl(
      <FormSheet
        triggerLabel="자재 추가"
        title="자재 추가"
        description="필수 항목을 입력하세요"
        uiKey="material-create"
        footer={<button type="submit">저장</button>}
      >
        <input aria-label="이름" />
      </FormSheet>,
    );
    const trigger = document.querySelector('[data-ui-key="material-create-open"]') as HTMLElement;
    expect(trigger).toBeTruthy();
    await userEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('data-ui-key', 'material-create');
    expect(screen.getByRole('heading', { name: '자재 추가' })).toBeInTheDocument();
    expect(screen.getByText('필수 항목을 입력하세요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument();
    const close = screen.getByRole('button', { name: '닫기' });
    expect(close).toHaveAttribute('data-ui-key', 'material-create-close');
    await userEvent.click(close);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('busy 이면 Esc 로 닫히지 않는다 (제출 중)', async () => {
    const onOpenChange = vi.fn();
    renderIntl(
      <FormSheet open busy onOpenChange={onOpenChange} title="수정">
        <p>본문</p>
      </FormSheet>,
    );
    const dialog = await screen.findByRole('dialog');
    act(() => {
      fireEvent.keyDown(dialog, { key: 'Escape' });
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('제어형: 바깥 상태로 열고 닫는다 (트리거 없음)', async () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>열기</button>
          <FormSheet open={open} onOpenChange={setOpen} title="제어형" uiKey="ctl">
            <p>본문</p>
          </FormSheet>
        </>
      );
    }
    renderIntl(<Host />);
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '열기' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '닫기' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

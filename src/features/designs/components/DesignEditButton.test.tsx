// B-12: 충돌 후 '최신 내용 불러오기'(router.refresh)로 props 가 바뀌어도 입력이 유지되고 충돌 안내가 사라진다
import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/features/designs/server/actions', () => ({ updateDesign: vi.fn() }));

import { updateDesign } from '@/features/designs/server/actions';
import { DesignEditButton } from '@/features/designs/components/DesignEditButton';

const read = (ns: string) => JSON.parse(readFileSync(`messages/ko/${ns}.json`, 'utf8'));
const messages = { designs: read('designs'), common: read('common'), errors: read('errors') };

const projectId = '00000000-0000-4000-8000-0000000000b1';
const id = '00000000-0000-4000-8000-0000000000d1';

function ui(props: { baseVersion: number; title: string }) {
  return (
    <NextIntlClientProvider locale="ko" messages={messages}>
      <DesignEditButton
        projectId={projectId}
        id={id}
        baseVersion={props.baseVersion}
        title={props.title}
        description="설명"
      />
    </NextIntlClientProvider>
  );
}

function byKey(key: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-ui-key="${key}"]`);
  if (!el) throw new Error(`no element ${key}`);
  return el;
}

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeAll(() => {
  // jsdom 의 <dialog> 는 showModal/close 가 없을 수 있다
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});
beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('DesignEditButton (B-12)', () => {
  it('충돌 후 새로고침으로 baseVersion·제목이 바뀌어도 입력은 유지, 안내는 사라지고 새 버전으로 저장한다', async () => {
    vi.mocked(updateDesign)
      .mockResolvedValueOnce({ ok: false, error: { code: 'VERSION_CONFLICT' } })
      .mockResolvedValueOnce({ ok: true, data: { version: 3 } });
    const view = render(ui({ baseVersion: 1, title: '원래 제목' }));
    fireEvent.click(byKey('design-edit-open'));
    const input = screen.getByDisplayValue('원래 제목');
    fireEvent.change(input, { target: { value: '내가 고친 제목' } });
    fireEvent.click(byKey('design-edit-submit'));
    await flush();
    expect(screen.getByRole('alert')).toHaveTextContent(messages.errors.VERSION_CONFLICT);

    fireEvent.click(screen.getByText(messages.common.action.loadLatest));
    expect(refresh).toHaveBeenCalled();
    // 서버가 다른 사람이 바꾼 내용으로 다시 그린다
    view.rerender(ui({ baseVersion: 2, title: '다른 사람이 바꾼 제목' }));
    await flush();
    expect(screen.getByDisplayValue('내가 고친 제목')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(byKey('design-edit-submit'));
    await flush();
    expect(updateDesign).toHaveBeenLastCalledWith(
      expect.objectContaining({ baseVersion: 2, title: '내가 고친 제목' }),
    );
  });

  it('시트를 다시 열면 서버의 최신 값으로 채운다 (닫은 뒤 입력은 버림)', async () => {
    const view = render(ui({ baseVersion: 1, title: '처음' }));
    fireEvent.click(byKey('design-edit-open'));
    fireEvent.change(screen.getByDisplayValue('처음'), { target: { value: '버릴 입력' } });
    fireEvent.click(screen.getByLabelText(messages.common.action.close));
    view.rerender(ui({ baseVersion: 2, title: '최신' }));
    fireEvent.click(byKey('design-edit-open'));
    expect(screen.getByDisplayValue('최신')).toBeInTheDocument();
  });

  it('검증 실패(빈 제목)는 서버를 부르지 않고 필드 오류 문구를 보인다', async () => {
    render(ui({ baseVersion: 1, title: '제목' }));
    fireEvent.click(byKey('design-edit-open'));
    fireEvent.change(screen.getByDisplayValue('제목'), { target: { value: '  ' } });
    fireEvent.click(byKey('design-edit-submit'));
    await flush();
    expect(updateDesign).not.toHaveBeenCalled();
    expect(screen.getByText(messages.errors.field.required)).toBeInTheDocument();
  });

  it('보관된 도안(CONFLICT)은 충돌 안내 대신 오류 토스트', async () => {
    const { toast } = await import('sonner');
    vi.mocked(updateDesign).mockResolvedValueOnce({ ok: false, error: { code: 'CONFLICT' } });
    render(ui({ baseVersion: 1, title: '제목' }));
    fireEvent.click(byKey('design-edit-open'));
    fireEvent.click(byKey('design-edit-submit'));
    await flush();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(messages.errors.CONFLICT);
  });
});

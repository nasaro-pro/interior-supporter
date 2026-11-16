// 2026-11 메모 대화창 — 내 글은 오른쪽 · 디자이너 답은 왼쪽, 시간 순, 연결 항목 카드, 마지막 내 글 아래 상태, 입력줄 전송
import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const createRequest = vi.fn();
vi.mock('../server/actions', () => ({
  createRequest: (...a: unknown[]) => createRequest(...a),
}));

import { ChatComposer } from './ChatComposer';
import { MemoChat } from './MemoChat';

const read = (ns: string) => JSON.parse(readFileSync(`messages/ko/${ns}.json`, 'utf8'));
const messages = { common: read('common'), errors: read('errors'), requests: read('requests') };
const renderKo = (node: ReactNode) =>
  render(
    <NextIntlClientProvider locale="ko" messages={messages} timeZone="Asia/Seoul">
      {node}
    </NextIntlClientProvider>,
  );
const P = '00000000-0000-4000-8000-000000000001';
const D = '00000000-0000-4000-8000-0000000000d1';
afterEach(cleanup);

const memos = [
  {
    id: 'm2',
    status: 'open' as const,
    target: null,
    entries: [
      {
        kind: 'original' as const,
        id: 'o2',
        body: '두 번째 메모',
        authorId: 'c',
        authorName: '김고객',
        createdAt: '2026-11-12T06:40:00Z',
      },
    ],
  },
  {
    id: 'm1',
    status: 'in_progress' as const,
    target: { type: 'designs' as const, id: D, label: '거실 평면도' },
    entries: [
      {
        kind: 'original' as const,
        id: 'o1',
        body: '콘센트 추가 가능할까요?',
        authorId: 'c',
        authorName: '김고객',
        createdAt: '2026-11-10T01:12:00Z',
      },
      {
        kind: 'reply' as const,
        id: 'r1',
        body: '네, 가능합니다.',
        authorId: 'd',
        authorName: '박디자이너',
        createdAt: '2026-11-10T02:03:00Z',
      },
    ],
  },
];

describe('MemoChat', () => {
  it('시간 순 · 좌우 · 날짜 구분 · 항목 카드 · 상태', () => {
    renderKo(
      <MemoChat memos={memos} memoHref={(id) => `/m/${id}`} targetHref={(x) => `/d/${x.id}`} />,
    );
    const items = [...document.querySelectorAll('[data-side]')].map((li) => [
      li.getAttribute('data-side'),
      li.textContent,
    ]);
    expect(items.map((x) => x[0])).toEqual(['mine', 'theirs', 'mine']);
    expect(items[0]?.[1]).toContain('콘센트');
    expect(items[1]?.[1]).toContain('박디자이너');
    expect(document.querySelector('[data-ui-key="memo-chat-target"]')?.getAttribute('href')).toBe(
      `/d/${D}`,
    );
    const status = [...document.querySelectorAll('[data-ui-key="memo-chat-status"]')];
    expect(status.map((s) => s.textContent)).toEqual(['처리 중', '접수']);
    expect(document.body.textContent).toContain('2026. 11. 10.(화)');
  });
});

describe('ChatComposer', () => {
  it('항목 자동 연결 + 자주 쓰는 말 → 전송', async () => {
    createRequest.mockResolvedValueOnce({ ok: true, data: { id: 'x' } });
    renderKo(<ChatComposer projectId={P} fixedTarget={{ type: 'designs', id: D }} chips />);
    fireEvent.click(document.querySelector('[data-ui-key="memo-chat-chip"]') as HTMLElement);
    await act(async () => {
      fireEvent.click(document.querySelector('[data-ui-key="item-memo-send"]') as HTMLElement);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: P,
        body: '색상 바꿀 수 있나요?',
        targetType: 'designs',
        targetId: D,
      }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it('빈 내용은 보내지 않는다', async () => {
    renderKo(<ChatComposer projectId={P} />);
    await act(async () => {
      fireEvent.click(document.querySelector('[data-ui-key="item-memo-send"]') as HTMLElement);
    });
    expect(createRequest).not.toHaveBeenCalled();
  });
});

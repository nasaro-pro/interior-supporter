// D-11 / 02 문서 6.5·7.2: 확정 버튼 3상태 + 상태 배지 톤 (none=neutral · confirmed=positive · needs_reconfirm=attention)
import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/features/designs/server/confirm-actions', () => ({ confirmTarget: vi.fn() }));

import { ConfirmButton } from '@/features/designs/components/ConfirmButton';
import { ConfirmStateBadge, VisibilityBadge } from '@/features/designs/components/StateBadges';

const read = (ns: string) => JSON.parse(readFileSync(`messages/ko/${ns}.json`, 'utf8'));
const messages = {
  designs: read('designs'),
  materials: read('materials'),
  common: read('common'),
  errors: read('errors'),
};
const base = {
  projectId: '00000000-0000-4000-8000-0000000000b1',
  targetId: '00000000-0000-4000-8000-0000000000d1',
  revision: 2,
  summary: '거실 도안 · 버전 2',
};
const wrap = (node: ReactNode) =>
  render(
    <NextIntlClientProvider locale="ko" messages={messages}>
      {node}
    </NextIntlClientProvider>,
  );
const byKey = (k: string) => document.querySelector<HTMLElement>(`[data-ui-key="${k}"]`);

afterEach(cleanup);

describe('ConfirmButton 3상태', () => {
  it('none → [이 도안 확정], 클릭하면 AlertDialog(대상 요약, 비위험 버튼)', async () => {
    wrap(<ConfirmButton {...base} targetType="designs" state="none" />);
    const open = byKey('design-confirm-open')!;
    expect(open).toHaveTextContent(messages.designs.action.confirm);
    await userEvent.click(open);
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveAttribute('data-ui-key', 'design-confirm-dialog');
    expect(dialog).toHaveTextContent(base.summary);
    expect(byKey('design-confirm-dialog-confirm')).toHaveTextContent(
      messages.designs.action.confirm,
    );
    expect(byKey('design-confirm-dialog-cancel')).toBeTruthy();
  });

  it('needs_reconfirm → 재확인 필요 배지(attention) + [변경됨 — 다시 확정]', () => {
    wrap(<ConfirmButton {...base} targetType="materials" state="needs_reconfirm" />);
    expect(byKey('material-confirm-open')).toHaveTextContent(messages.materials.action.reconfirm);
    const badge = document.querySelector('[data-status="needs_reconfirm"]');
    expect(badge).toHaveAttribute('data-tone', 'attention');
  });

  it('confirmed → "○○님이 … 확정(리비전 N)" 문구, 버튼 없음', () => {
    wrap(
      <ConfirmButton
        {...base}
        targetType="designs"
        state="confirmed"
        confirmedLine="고객1님이 2026-10-06 14:20 확정(리비전 2)"
      />,
    );
    expect(byKey('design-confirm-open')).toBeNull();
    expect(byKey('design-confirmed-line')).toHaveTextContent(
      '고객1님이 2026-10-06 14:20 확정(리비전 2)',
    );
  });
});

describe('상태 배지 톤 (02 문서 7.2)', () => {
  it('확정 상태·공개 배지', () => {
    wrap(
      <>
        <ConfirmStateBadge state="none" label="미확정" />
        <ConfirmStateBadge state="confirmed" label="확정" />
        <VisibilityBadge isPublic label="공개" />
        <VisibilityBadge isPublic={false} label="비공개" />
      </>,
    );
    const tone = (s: string) =>
      document.querySelector(`[data-status="${s}"]`)?.getAttribute('data-tone');
    expect(tone('unconfirmed')).toBe('neutral');
    expect(tone('confirmed')).toBe('positive');
    expect(tone('public')).toBe('brand');
    expect(tone('private')).toBe('neutral');
  });
});

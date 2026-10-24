// C-09 — 호출자가 필터 빈 결과 안내를 이미 보이면(emptyText=null) 달력 빈 문구를 생략한다
import { describe, expect, it, vi } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { rich: (key: string) => key }),
  useLocale: () => 'ko',
}));

import { ScheduleBoard } from './ScheduleBoard';

const props = {
  state: {
    view: 'month' as const,
    month: '2026-10',
    monthInvalid: false,
    day: null,
    archived: false,
  },
  today: '2026-10-13',
  base: '/app/studio/calendar',
  events: [],
  eventHref: () => '#',
  showVisibility: true,
  allowTimeline: false,
};

describe('ScheduleBoard emptyText (C-09)', () => {
  it('빈 달이면 emptyText 를 한 번 보여 준다', () => {
    const { container } = render(<ScheduleBoard {...props} emptyText="이 달 일정이 없습니다" />);
    expect(within(container).getAllByText('이 달 일정이 없습니다')).toHaveLength(1);
    cleanup();
  });

  it('emptyText=null 이면 빈 문구를 그리지 않는다 (필터 빈 결과와 이중 표시 방지)', () => {
    const withText = render(<ScheduleBoard {...props} emptyText="이 달 일정이 없습니다" />);
    const before = withText.container.querySelectorAll('p').length;
    cleanup();
    const { container } = render(<ScheduleBoard {...props} emptyText={null} />);
    expect(within(container).queryByText('이 달 일정이 없습니다')).toBeNull();
    expect(container.querySelectorAll('p')).toHaveLength(before - 1);
    cleanup();
  });
});

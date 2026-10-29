// CU-06 고객 홈 '최근 업데이트' — 고객에게 요청은 '메모'로, 담당자 개요는 그대로 '요청'
import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import type { SummaryItem } from '@/shared/contracts/integration';
import { DEFAULT_HOME_SECTIONS } from '../home-sections';
import { CustomerHomeBody, OverviewBlocks } from './summary-blocks';

const read = (ns: string) => JSON.parse(readFileSync(`messages/ko/${ns}.json`, 'utf8'));
const messages = {
  common: read('common'),
  projects: read('projects'),
  history: read('history'),
  requests: read('requests'),
};

const item = (kind: SummaryItem['kind'], title: string): SummaryItem => ({
  kind,
  id: `${kind}-1`,
  title,
  at: '2026-10-28T09:00:00Z',
  screenId: 'CL-03' as SummaryItem['screenId'],
  href: '/x',
});
const recent = {
  items: [item('requests', '아트월 조명 색온도'), item('designs', '거실 3D 투시도')],
  failed: false,
};
const empty = { items: [], failed: false };

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="ko" messages={messages} timeZone="Asia/Seoul">
      {ui}
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

describe('최근 업데이트 항목 종류 이름', () => {
  it('고객 홈: 요청은 메모로, 다른 항목은 그대로', () => {
    wrap(
      <CustomerHomeBody
        project={{
          homeMessage: '',
          homeSections: DEFAULT_HOME_SECTIONS,
          homeTheme: 'brand',
          currentPhase: '',
          startDate: null,
          endDate: null,
        }}
        blocks={{ recent, schedule: empty, documents: empty }}
      />,
    );
    const memo = screen.getByText('아트월 조명 색온도').closest('a')!;
    expect(memo).toHaveTextContent('메모');
    expect(memo).not.toHaveTextContent('요청');
    expect(screen.getByText('거실 3D 투시도').closest('a')!).toHaveTextContent('도안');
  });

  it('담당자 개요: 요청은 그대로 요청', () => {
    wrap(<OverviewBlocks recent={recent} schedule={empty} />);
    expect(screen.getByText('아트월 조명 색온도').closest('a')!).toHaveTextContent('요청');
  });
});

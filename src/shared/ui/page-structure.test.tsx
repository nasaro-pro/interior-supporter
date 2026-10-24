// P3 UI 표준 — 페이지 골격·상태·버튼: SegmentedTabs · Section · PageHeader · LoadMore · 상태 6종 · ListSkeleton · Button pending · ButtonLink · SwitchField
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SegmentedTabs } from './segmented-tabs';
import { Section, SectionHeader } from './section';
import { LoadMore, PageHeader } from './page-parts';
import { EmptyState, ErrorState, FilterEmptyState, ListSkeleton } from './states';
import { Button } from './button';
import { ButtonLink } from './button-link';
import { SwitchField } from './switch-field';
import { linkClass, tableScrollClass } from './styles';
import { koMessages, renderIntl } from './test-intl';

afterEach(cleanup);
const NO_CLONE = /rounded-none|tracking-\[|font-mono|uppercase|#[0-9a-f]{3}/i;

describe('SegmentedTabs', () => {
  it('nav(aria-label) 안의 링크, 현재 칸만 aria-current=page', () => {
    renderIntl(
      <SegmentedTabs
        label="보관 상태"
        items={[
          { key: 'a', href: '/x', label: '진행', current: true, uiKey: 'request-filter-active' },
          { key: 'b', href: '/x?archived=1', label: '보관함', current: false, count: 3 },
        ]}
      />,
    );
    const nav = screen.getByRole('navigation', { name: '보관 상태' });
    expect(nav).toBeInTheDocument();
    const active = screen.getByRole('link', { name: '진행' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active).toHaveAttribute('data-ui-key', 'request-filter-active');
    const other = screen.getByRole('link', { name: /보관함/ });
    expect(other).not.toHaveAttribute('aria-current');
    expect(other).toHaveAttribute('href', '/x?archived=1');
    expect(other).toHaveTextContent('3');
    expect(active.className).toMatch(/motion-safe:transition-colors/);
    expect(active.className).not.toMatch(NO_CLONE);
  });
});

describe('Section · PageHeader', () => {
  it('Section 은 제목으로 이름 붙은 구획, card 변형은 토큰 면', () => {
    renderIntl(
      <Section title="참여자" meta="3명" actions={<button>초대</button>} variant="card">
        <p>본문</p>
      </Section>,
    );
    const region = screen.getByRole('region', { name: '참여자' });
    expect(region.className).toMatch(/bg-card/);
    expect(screen.getByRole('heading', { level: 2, name: '참여자' })).toBeInTheDocument();
    expect(screen.getByText('3명')).toBeInTheDocument();
  });
  it('SectionHeader as=h3', () => {
    renderIntl(<SectionHeader title="대기 중인 초대" as="h3" />);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('대기 중인 초대');
  });
  it('PageHeader: h1 + 설명 + meta + actions (eyebrow 없음)', () => {
    renderIntl(
      <PageHeader title="요청" description="설명" meta="12건" actions={<button>추가</button>} />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('요청');
    expect(screen.getByText('12건')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '추가' })).toBeInTheDocument();
  });
});

describe('LoadMore', () => {
  it('href 로 링크(기본 문구·ui-key), null 이면 없음, label 덮어쓰기', () => {
    const { rerender } = renderIntl(<LoadMore href="/x?size=60" />);
    const link = screen.getByRole('link', { name: koMessages.common.action.loadMore });
    expect(link).toHaveAttribute('href', '/x?size=60');
    expect(link).toHaveAttribute('data-ui-key', 'list-load-more');
    cleanup();
    renderIntl(<LoadMore href={null} />);
    expect(screen.queryByRole('link')).toBeNull();
    cleanup();
    renderIntl(<LoadMore href="/y?limit=60" label="이전 기록 더 보기" />);
    expect(screen.getByRole('link', { name: '이전 기록 더 보기' })).toHaveAttribute(
      'href',
      '/y?limit=60',
    );
    void rerender;
  });
});

describe('상태 6종 확장', () => {
  it('FilterEmptyState resetHref → [필터 초기화] 링크', () => {
    renderIntl(<FilterEmptyState resetHref="/list" />);
    const link = screen.getByRole('link', { name: koMessages.common.action.resetFilters });
    expect(link).toHaveAttribute('href', '/list');
    expect(link).toHaveAttribute('data-ui-key', 'filter-reset');
    expect(screen.getByRole('status')).toHaveTextContent(koMessages.common.state.filterEmpty);
  });
  it('ErrorState onRetry → [다시 시도]', async () => {
    const onRetry = vi.fn();
    renderIntl(<ErrorState errorRef="r1" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: koMessages.common.action.retry }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toHaveTextContent('r1');
  });
  it('EmptyState 는 role=status 와 다음 행동', () => {
    renderIntl(<EmptyState title="자재가 없습니다" action={<button>자재 추가</button>} />);
    expect(screen.getByRole('status')).toHaveTextContent('자재가 없습니다');
  });
  it.each(['list', 'grid', 'detail'] as const)(
    'ListSkeleton %s: role=status·라벨, 깜빡임은 motion-safe 에서만',
    (variant) => {
      const { container } = renderIntl(<ListSkeleton variant={variant} rows={4} />);
      const box = screen.getByRole('status', { name: koMessages.common.a11y.loading });
      expect(box).toHaveAttribute('data-variant', variant);
      const blocks = container.querySelectorAll('[data-slot="skeleton"]');
      expect(blocks.length).toBeGreaterThan(0);
      blocks.forEach((b) => {
        expect(b.className).toMatch(/motion-safe:animate-pulse/);
        expect(b.className).not.toMatch(/(^|\s)animate-pulse/);
      });
    },
  );
  it('ListSkeleton label 덮어쓰기', () => {
    renderIntl(<ListSkeleton label="자재 불러오는 중" />);
    expect(screen.getByRole('status', { name: '자재 불러오는 중' })).toBeInTheDocument();
  });
});

describe('Button pending · ButtonLink · styles', () => {
  it('pending → disabled + aria-busy + motion-safe 회전 아이콘', () => {
    const { container } = renderIntl(<Button pending>저장</Button>);
    const btn = screen.getByRole('button', { name: '저장' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    const icon = container.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon?.getAttribute('class')).toMatch(/motion-safe:animate-spin/);
  });
  it('pending 아님 → 아이콘·aria-busy 없음', () => {
    const { container } = renderIntl(<Button>저장</Button>);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy');
    expect(container.querySelector('svg')).toBeNull();
  });
  it('ButtonLink 는 버튼 모양 링크 (반경 토큰, 롤링 없음)', () => {
    renderIntl(
      <ButtonLink href="/a" variant="outline" size="sm" data-ui-key="go">
        이동
      </ButtonLink>,
    );
    const link = screen.getByRole('link', { name: '이동' });
    expect(link).toHaveAttribute('href', '/a');
    expect(link).toHaveAttribute('data-ui-key', 'go');
    expect(link.className).toMatch(/rounded-/);
    expect(link.className).not.toMatch(NO_CLONE);
  });
  it('styles: linkClass·tableScrollClass 토큰·가로 스크롤 가둠', () => {
    expect(linkClass).toMatch(/text-primary/);
    expect(tableScrollClass).toMatch(/overflow-x-auto/);
    expect(tableScrollClass).toMatch(/relative/);
    expect(tableScrollClass).toMatch(/min-w-0/);
  });
});

describe('SwitchField', () => {
  it('role=switch 에 라벨·설명 연결, 토글 콜백', async () => {
    const onChange = vi.fn();
    renderIntl(
      <SwitchField
        id="home-visible"
        label="고객 홈에 표시"
        description="끄면 고객에게 보이지 않습니다"
        onCheckedChange={onChange}
        uiKey="home-section-toggle"
      />,
    );
    const sw = screen.getByRole('switch', { name: '고객 홈에 표시' });
    expect(sw).toHaveAccessibleDescription('끄면 고객에게 보이지 않습니다');
    expect(sw).toHaveAttribute('data-ui-key', 'home-section-toggle');
    await userEvent.click(sw);
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0]![0]).toBe(true);
  });
});

import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PublicWorkCard } from '../lib/grid';
import { PortfolioGrid } from './PortfolioGrid';

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
const portfolio = JSON.parse(readFileSync('messages/ko/portfolio.json', 'utf8'));
const materials = JSON.parse(readFileSync('messages/ko/materials.json', 'utf8'));

const cover = {
  path: 'c/w/1.webp',
  thumbPath: 'c/w/1_t.webp',
  width: 2000,
  height: 1500,
  caption: '',
};
const work = (id: string, extra: Partial<PublicWorkCard> = {}): PublicWorkCard => ({
  id,
  title: `사례 ${id}`,
  areaLabel: '청담동',
  sizePyeong: 32,
  spaces: ['living'],
  completedOn: '2026-11-20',
  durationWeeks: 9,
  isFeatured: false,
  cover,
  ...extra,
});
const renderGrid = (node: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="ko" messages={{ portfolio, materials }}>
      {node}
    </NextIntlClientProvider>,
  );
afterEach(cleanup);

describe('PortfolioGrid — 카드', () => {
  it('사진 + 이름 + "PY | Weeks" 한 줄, 상세 링크 (지역·연도 같은 자세한 정보는 상세에서)', () => {
    renderGrid(<PortfolioGrid slug="kingwang" works={[work('a'), work('b')]} />);
    const card = screen.getByRole('link', { name: /사례 a/ });
    expect(card).toHaveAttribute('href', '/c/kingwang/works/a');
    expect(within(card).getByRole('presentation')).toHaveAttribute(
      'src',
      expect.stringContaining('1_t.webp'),
    );
    expect(card).toHaveTextContent('32PY');
    expect(card).toHaveTextContent('9Weeks');
    expect(card).toHaveAccessibleName(/32평.*공사 9주/); // 화면 읽기는 한국어로
    expect(card.textContent).not.toContain('청담동');
  });
  it('평수·기간이 없으면 그 칸을 뺀다', () => {
    renderGrid(
      <PortfolioGrid
        slug="k"
        works={[
          work('a', { durationWeeks: null }),
          work('b', { sizePyeong: null, durationWeeks: null }),
        ]}
      />,
    );
    expect(screen.getByRole('link', { name: /사례 a/ })).not.toHaveTextContent('Weeks');
    expect(screen.getByRole('link', { name: /사례 b/ })).not.toHaveTextContent('PY');
  });
  it('대표 사진이 없으면 준비 중, 사례가 없으면 빈 상태', () => {
    renderGrid(<PortfolioGrid slug="kingwang" works={[work('c', { cover: null })]} />);
    expect(screen.getByText(portfolio.public.noCover)).toBeInTheDocument();
    cleanup();
    renderGrid(<PortfolioGrid slug="kingwang" works={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent(portfolio.public.empty);
  });
  it('미리보기: 미리보기 주소 + 비공개 배지', () => {
    renderGrid(<PortfolioGrid slug="k" works={[work('a'), work('b')]} preview draftIds={['a']} />);
    const a = screen.getByRole('link', { name: /사례 a/ });
    expect(a.getAttribute('href')).toContain('portfolio-preview');
    expect(within(a).getByText(portfolio.preview.draft)).toBeInTheDocument();
    expect(
      within(screen.getByRole('link', { name: /사례 b/ })).queryByText(portfolio.preview.draft),
    ).toBeNull();
  });
});

describe('PortfolioGrid — C 갤러리 + 공간 필터', () => {
  const works = [
    work('a', { spaces: ['living', 'kitchen'] }),
    work('b', { spaces: ['kitchen'] }),
    work('c', { spaces: ['bathroom'] }),
  ];
  it('기본은 갤러리, 사례가 있는 공간만 칩, 누르면 거른다', () => {
    const { container } = renderGrid(<PortfolioGrid slug="k" works={works} />);
    expect(container.querySelector('[data-layout="gallery"]')).not.toBeNull();
    const group = screen.getByRole('group', { name: portfolio.public.filterLabel });
    const chips = within(group).getAllByRole('button');
    expect(chips.map((b) => b.textContent?.replace(/\s*\(\d+\)$/, ''))).toEqual([
      '전체',
      materials.space.living,
      materials.space.kitchen,
      materials.space.bathroom,
    ]);
    fireEvent.click(
      within(group).getByRole('button', { name: new RegExp(materials.space.kitchen) }),
    );
    expect(screen.getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual([
      '/c/k/works/a',
      '/c/k/works/b',
    ]);
    expect(screen.getByRole('status')).toHaveTextContent('사례 2개');
  });
  it('업체가 필터를 끄면 칩이 없다 / 공간이 하나뿐이어도 없다', () => {
    renderGrid(<PortfolioGrid slug="k" works={works} galleryFilter={false} />);
    expect(screen.queryByRole('group')).toBeNull();
    cleanup();
    renderGrid(<PortfolioGrid slug="k" works={[work('a'), work('b')]} />);
    expect(screen.queryByRole('group')).toBeNull();
  });
});

describe('PortfolioGrid — D 가로 넘김', () => {
  it('넘김 줄 + 화살표(처음엔 이전이 꺼짐) + 장수 표시', () => {
    const { container } = renderGrid(
      <PortfolioGrid
        slug="k"
        works={[work('a'), work('b'), work('c'), work('d')]}
        layout="carousel"
        carouselPer={4}
      />,
    );
    const sec = container.querySelector('[data-layout="carousel"]');
    expect(sec).toHaveAttribute('data-per', '4');
    expect(screen.getByRole('list', { name: portfolio.public.carouselLabel })).toHaveAttribute(
      'tabindex',
      '0',
    );
    expect(screen.getByRole('button', { name: portfolio.public.carouselPrev })).toBeDisabled();
    expect(screen.getByRole('button', { name: portfolio.public.carouselNext })).toBeInTheDocument();
    expect(container).toHaveTextContent('01 / 04');
    expect(screen.queryByRole('group')).toBeNull(); // 가로 넘김엔 필터 없음
  });
});

describe('PortfolioGrid — E 목록형', () => {
  it('넓은 사진 한 장씩, 필터·화살표 없음, 이름과 평형|기간 한 줄', () => {
    const { container } = renderGrid(
      <PortfolioGrid
        slug="k"
        works={[work('a', { spaces: ['living'] }), work('b', { spaces: ['kitchen'] })]}
        layout="list"
      />,
    );
    expect(container.querySelector('[data-layout="list"]')).not.toBeNull();
    expect(screen.getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual([
      '/c/k/works/a',
      '/c/k/works/b',
    ]);
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.queryByRole('button', { name: portfolio.public.carouselNext })).toBeNull();
    expect(container.querySelector('.md\\:aspect-\\[3\\/2\\]')).not.toBeNull();
  });
});

describe('PortfolioGrid — 휴대폰 따로', () => {
  it('휴대폰 배열이 PC와 같으면 하나만, 다르면 둘 다 그리고 화면 폭으로 하나만 보인다', () => {
    const ws = [work('a', { spaces: ['living'] }), work('b', { spaces: ['kitchen'] })];
    const { container } = renderGrid(
      <PortfolioGrid slug="k" works={ws} layout="gallery" mobileLayout="gallery" />,
    );
    expect(container.querySelectorAll('[data-layout]')).toHaveLength(1);
    cleanup();
    const r = renderGrid(
      <PortfolioGrid slug="k" works={ws} layout="gallery" mobileLayout="list" />,
    );
    const m = r.container.querySelector('[data-device="mobile"]')!;
    const pc = r.container.querySelector('[data-device="pc"]')!;
    expect(m).toHaveClass('md:hidden');
    expect(m.querySelector('[data-layout="list"]')).not.toBeNull();
    expect(pc).toHaveClass('hidden', 'md:block');
    expect(pc.querySelector('[data-layout="gallery"]')).not.toBeNull();
    // 제목 id 가 겹치지 않는다
    const ids = [...r.container.querySelectorAll('h2[id]')].map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('휴대폰 갤러리 1칸', () => {
    const { container } = renderGrid(
      <PortfolioGrid slug="k" works={[work('a'), work('b')]} mobileCols={1} />,
    );
    expect(container.querySelector('[data-layout="gallery"]')).toHaveAttribute('data-cols', '1');
    expect(container.querySelector('ul.grid-cols-1')).not.toBeNull();
  });
});

describe('PortfolioGrid — 넘김 줄이 페이지를 가로로 늘리지 않음', () => {
  it('넘김 줄은 relative (안쪽 sr-only 글자를 줄 안에 가둠)', () => {
    renderGrid(
      <PortfolioGrid
        slug="k"
        works={[work('a'), work('b'), work('c'), work('d'), work('e')]}
        layout="carousel"
      />,
    );
    expect(screen.getByRole('list', { name: portfolio.public.carouselLabel })).toHaveClass(
      'relative',
      'overflow-x-auto',
    );
  });
});

describe('PortfolioGrid — 업체가 고친 문구', () => {
  it('SELECTED WORKS 를 숨기고 시공 사례 제목을 바꾼다 (제목은 숨기지 않음)', () => {
    renderGrid(
      <PortfolioGrid
        slug="k"
        works={[work('a')]}
        labels={{ worksKicker: false, worksTitle: '우리가 만든 집' }}
      />,
    );
    expect(screen.queryByText('Selected Works')).toBeNull();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('우리가 만든 집');
  });
  it('기본은 Selected Works · 시공 사례', () => {
    renderGrid(<PortfolioGrid slug="k" works={[work('a')]} />);
    expect(screen.getByText('Selected Works')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      portfolio.public.worksTitle,
    );
  });
});

describe('PortfolioGrid — 미리보기 견본 칸 (사례가 없을 때)', () => {
  it('누를 수 없고, 사진 대신 "사진 자리"와 "견본" 배지를 그린다', () => {
    renderGrid(
      <PortfolioGrid
        slug="k"
        preview
        sample
        works={[work('s1', { cover: null }), work('s2', { cover: null, spaces: ['kitchen'] })]}
      />,
    );
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getAllByText(portfolio.preview.sample.photo)).toHaveLength(2);
    expect(screen.getAllByText(portfolio.preview.sample.badge)).toHaveLength(2);
    expect(screen.queryByText(portfolio.public.noCover)).not.toBeInTheDocument();
    expect(screen.getByText('사례 s1')).toBeInTheDocument();
  });
  it('견본이 아니면 지금처럼 링크 카드', () => {
    renderGrid(<PortfolioGrid slug="k" works={[work('a')]} />);
    expect(screen.getByRole('link', { name: /사례 a/ })).toBeInTheDocument();
    expect(screen.queryByText(portfolio.preview.sample.badge)).not.toBeInTheDocument();
  });
});

import { readFileSync } from 'node:fs';
import { cleanup, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PortfolioCompany, PublicWorkDetail } from '../lib/parse';
import { PortfolioIntro, PortfolioWorkHead } from './PortfolioHeads';
import { PortfolioPreviewBanner } from './PortfolioPreviewBanner';
import { PortfolioShell } from './PortfolioShell';

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
const messages = {
  portfolio: JSON.parse(readFileSync('messages/ko/portfolio.json', 'utf8')),
  materials: JSON.parse(readFileSync('messages/ko/materials.json', 'utf8')),
};
const p = messages.portfolio;
const wrap = (n: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="ko" messages={messages}>
      {n}
    </NextIntlClientProvider>,
  );
afterEach(cleanup);

const company: PortfolioCompany = {
  slug: 'kingwang',
  name: '킹왕짱인테리어',
  intro: '오래 살아도 편한 집을 짓는 스튜디오',
  contactPhone: '02-512-3400',
  contactUrl: null,
  pageTone: 'sand',
  logoPath: null,
  businessName: '',
  representative: '이재서',
  businessRegNo: null,
  address: '',
  csHours: '',
  featuredLimit: 3,
};

describe('PortfolioShell', () => {
  it('브랜드 토큰·분위기 바탕을 이 틀 안에만 적용한다', () => {
    wrap(
      <PortfolioShell company={company} homeHref="/c/kingwang">
        <main>내용</main>
      </PortfolioShell>,
    );
    const shell = document.querySelector('[data-ui-key="portfolio-shell"]') as HTMLElement;
    expect(shell.style.getPropertyValue('--background')).toBe('#E9DCC8'); // 샌드
    expect(shell.style.getPropertyValue('--muted-foreground')).toBe('#625C53');
    expect(shell.style.getPropertyValue('--primary')).toBe('#484D49');
    expect(shell).toHaveAttribute('data-tone', 'sand');
  });
  it('머리: 로고가 없으면 첫 글자, 업체명이 홈 링크 / 바닥·고정 상담', () => {
    wrap(
      <PortfolioShell company={company} homeHref="/c/kingwang">
        <main />
      </PortfolioShell>,
    );
    expect(screen.getByRole('link', { name: /킹왕짱인테리어/ })).toHaveAttribute(
      'href',
      '/c/kingwang',
    );
    expect(screen.getByRole('contentinfo')).toHaveTextContent('대표이재서');
    expect(screen.getByRole('navigation', { name: p.public.contact })).toBeInTheDocument();
  });
  it('미리보기는 고정 상담 버튼을 끄고 띠를 위에 그린다', () => {
    wrap(
      <PortfolioShell
        company={company}
        homeHref="/x"
        contactBar={false}
        banner={
          <PortfolioPreviewBanner
            isPublic={false}
            draftCount={2}
            settingsHref="/s"
            publicHref="/c/kingwang"
          />
        }
      >
        <main />
      </PortfolioShell>,
    );
    expect(screen.queryByRole('navigation', { name: p.public.contact })).toBeNull();
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent(p.preview.publicOff);
    expect(banner).toHaveTextContent('비공개 사례 2건 포함');
    expect(within(banner).queryByRole('link', { name: p.preview.openPublic })).toBeNull(); // 꺼져 있으면 공개 링크 없음
  });
});

describe('머리', () => {
  it('목록 머리: 업체명 h1·소개 (단순하게, 숫자 없음)', () => {
    wrap(<PortfolioIntro company={company} />);
    expect(screen.getByRole('heading', { level: 1, name: '킹왕짱인테리어' })).toBeInTheDocument();
    expect(screen.getByText(company.intro)).toBeInTheDocument();
  });
  it('상세 머리: 평·주·완공 숫자, 없는 값은 칸째 빼고, 뒤로 링크', () => {
    const work = {
      id: 'w',
      title: '청담동 32평 리모델링',
      areaLabel: '청담동',
      sizePyeong: 32,
      durationWeeks: 9,
      completedOn: '2026-11-20',
      spaces: [],
      summary: '설명',
      images: [],
      company,
    } as PublicWorkDetail;
    wrap(<PortfolioWorkHead work={work} backHref="/c/kingwang" />);
    const stats = document.querySelector('[data-ui-key="portfolio-work-stats"]')!;
    expect(stats.textContent).toBe('32평9주 공사2026. 11.완공');
    expect(screen.getByRole('link', { name: p.public.backToList })).toHaveAttribute(
      'href',
      '/c/kingwang',
    );
    cleanup();
    wrap(<PortfolioWorkHead work={{ ...work, durationWeeks: null }} backHref="/" />);
    expect(document.querySelector('[data-ui-key="portfolio-work-stats"]')!.children).toHaveLength(
      2,
    );
  });
});

describe('작은 문구 · 홈페이지 이름', () => {
  it('맨 위 작은 글씨를 바꾸거나 숨긴다', () => {
    wrap(<PortfolioIntro company={{ ...company, labels: { introKicker: 'HOUSEON STUDIO' } }} />);
    expect(screen.getByText('HOUSEON STUDIO')).toBeInTheDocument();
    cleanup();
    wrap(<PortfolioIntro company={{ ...company, labels: { introKicker: false } }} />);
    expect(document.querySelector('[data-ui-key="portfolio-intro-kicker"]')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('킹왕짱인테리어');
  });
});

describe('로고 숨기기', () => {
  it('숨기면 로고·첫 글자 칸 없이 이름만', () => {
    wrap(
      <PortfolioShell company={{ ...company, logoHidden: true }} homeHref="/c/kingwang">
        <main />
      </PortfolioShell>,
    );
    const home = document.querySelector('[data-ui-key="portfolio-home-link"]')!;
    expect(home.querySelector('img')).toBeNull();
    expect(home.querySelectorAll('span')).toHaveLength(1);
    expect(home).toHaveTextContent('킹왕짱인테리어');
    cleanup();
    wrap(
      <PortfolioShell company={company} homeHref="/c/kingwang">
        <main />
      </PortfolioShell>,
    );
    expect(
      document.querySelector('[data-ui-key="portfolio-home-link"]')!.querySelectorAll('span'),
    ).toHaveLength(2); // 첫 글자 칸 + 이름
  });
});

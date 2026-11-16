// 상세 화면 부품: 공간 탭·크게 보기(n / N)·상담 띠·휴대폰 고정 버튼·푸터
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicWorkImage } from '../lib/grid';
import type { PortfolioCompany } from '../lib/parse';
import { PortfolioContactBand, PortfolioContactBar } from './PortfolioContact';
import { PortfolioFooter } from './PortfolioFooter';
import { PortfolioGallery } from './PortfolioGallery';

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
const messages = {
  portfolio: JSON.parse(readFileSync('messages/ko/portfolio.json', 'utf8')),
  materials: JSON.parse(readFileSync('messages/ko/materials.json', 'utf8')),
  designs: JSON.parse(readFileSync('messages/ko/designs.json', 'utf8')),
};
const p = messages.portfolio.public;
const wrap = (node: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="ko" messages={messages}>
      {node}
    </NextIntlClientProvider>,
  );

const img = (
  id: string,
  role: PublicWorkImage['role'],
  space: PublicWorkImage['space'],
  spaceLabel = '',
  caption = '',
) =>
  ({
    id,
    role,
    space,
    spaceLabel,
    caption,
    path: `c/w/${id}.webp`,
    thumbPath: `c/w/${id}_t.webp`,
    width: 2000,
    height: 1500,
    thumbWidth: 640,
    thumbHeight: 480,
  }) as PublicWorkImage;

const images = [
  img('l1', 'gallery', 'living', '', '거실 창가'),
  img('aft', 'after', 'living'),
  img('bef', 'before', 'living'),
  img('bA', 'gallery', 'bedroom', '침실A'),
  img('bB', 'gallery', 'bedroom', '침실B'),
];

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PortfolioGallery', () => {
  it('비포·애프터 슬라이더는 공개 주소로, 접근 확인 요청 없이', () => {
    wrap(<PortfolioGallery title="청담동" images={images} />);
    expect(screen.getByTestId('compare-a')).toHaveAttribute(
      'src',
      expect.stringContaining('/c/w/aft.webp'),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('공간 탭: 전체·거실·침실A·침실B, 비포는 탭에 없음', () => {
    wrap(<PortfolioGallery title="청담동" images={images} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['전체4', '거실2', '침실A1', '침실B1']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(within(screen.getByRole('tabpanel')).getAllByRole('button')).toHaveLength(4);
  });

  it('탭을 누르거나 화살표 키로 옮기면 그 공간 사진만', () => {
    wrap(<PortfolioGallery title="청담동" images={images} />);
    fireEvent.click(screen.getByRole('tab', { name: /침실A/ }));
    expect(within(screen.getByRole('tabpanel')).getAllByRole('button')).toHaveLength(1);
    fireEvent.keyDown(screen.getByRole('tab', { name: /침실A/ }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /침실B/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /침실B/ })).toHaveFocus();
  });

  it('크게 보기: n / N, ←→ 로 넘기고 끝에서 처음으로, Esc 로 닫기', () => {
    wrap(<PortfolioGallery title="청담동" images={images} />);
    fireEvent.click(within(screen.getByRole('tabpanel')).getAllByRole('button')[0]!);
    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(dialog).toHaveTextContent('1 / 4');
    expect(dialog).toHaveTextContent('거실 창가');
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
    expect(dialog).toHaveTextContent('4 / 4');
    fireEvent.click(within(dialog).getByRole('button', { name: p.next, hidden: true }));
    expect(dialog).toHaveTextContent('1 / 4');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
  });
});

const company: PortfolioCompany = {
  slug: 'kingwang',
  intro: '',
  name: '킹왕짱인테리어',
  contactPhone: '02-512-3400',
  contactUrl: 'https://pf.kakao.com/_kingwang',
  pageTone: 'ivory',
  logoPath: null,
  businessName: '킹왕짱인테리어(주)',
  representative: '이재서',
  businessRegNo: '123-45-67890',
  address: '서울 강남구 도산대로 1',
  csHours: '평일 09:00~18:00',
  featuredLimit: 3,
};

describe('상담', () => {
  it('상담 띠: 링크는 새 탭(noopener), 전화는 tel:', () => {
    wrap(<PortfolioContactBand company={company} />);
    expect(screen.getByRole('heading', { name: p.ctaTitle })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: p.ctaLink });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByRole('link', { name: /전화 상담/ })).toHaveAttribute(
      'href',
      'tel:025123400',
    );
  });

  it('휴대폰 고정 버튼은 md 이상에서 숨김', () => {
    wrap(<PortfolioContactBar company={company} />);
    expect(screen.getByRole('navigation', { name: p.contact })).toHaveClass('fixed', 'md:hidden');
  });

  it('연락처가 하나도 없으면 아무것도 그리지 않는다', () => {
    const { container } = wrap(
      <>
        <PortfolioContactBand company={{ ...company, contactPhone: null, contactUrl: null }} />
        <PortfolioContactBar company={{ ...company, contactPhone: null, contactUrl: null }} />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('PortfolioFooter', () => {
  it('사업자 정보 줄 · CONTACT · 서비스 표시', () => {
    wrap(<PortfolioFooter company={company} />);
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent('사업자등록번호123-45-67890');
    expect(within(footer).getByRole('link', { name: '02-512-3400' })).toHaveAttribute(
      'href',
      'tel:025123400',
    );
    expect(footer).toHaveTextContent('평일 09:00~18:00');
    expect(within(footer).getByRole('link', { name: p.poweredBy })).toHaveAttribute('href', '/');
    expect(footer).toHaveAttribute('data-footer-tone', 'soft');
  });
  it('바닥 문구 · SNS(새 창, 이름 읽기) · 이메일 · 바닥 색', () => {
    wrap(
      <PortfolioFooter
        company={{
          ...company,
          footerSlogan: '살면서 / 오래 편한 집',
          contactEmail: 'hello@x.kr',
          footerTone: 'deep',
          snsLinks: ['https://instagram.com/houseon', 'http://bad.com', 'https://pf.kakao.com/_a'],
        }}
      />,
    );
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent('살면서');
    expect(footer).toHaveAttribute('data-footer-tone', 'deep');
    const sns = within(
      footer.querySelector('[data-ui-key="portfolio-footer-sns"]') as HTMLElement,
    ).getAllByRole('link');
    expect(sns).toHaveLength(2); // http 주소는 빠진다
    // 2026-11: 상담 링크가 있으면 CONTACT 칸에도 연결 (머리 '상담 신청'이 이 칸으로 내려온다)
    const chat = footer.querySelector('[data-ui-key="portfolio-footer-chat"]');
    if (chat) expect(chat).toHaveAttribute('target', '_blank');
    expect(sns[0]).toHaveAttribute('rel', 'noopener noreferrer');
    expect(sns[0]).toHaveAccessibleName(/인스타그램/);
    expect(within(footer).getByRole('link', { name: 'hello@x.kr' })).toHaveAttribute(
      'href',
      'mailto:hello@x.kr',
    );
  });
  it('SNS 가 없으면 FOLLOW US 줄을 그리지 않는다', () => {
    wrap(<PortfolioFooter company={{ ...company, snsLinks: [] }} />);
    expect(screen.queryByText('FOLLOW US')).toBeNull();
  });
});

describe('업체가 고친 작은 문구 (바닥 칸)', () => {
  it('FOLLOW US 를 바꾸고 CONTACT 를 숨긴다 (CONTACT 는 화면 읽기용 제목만 남김)', () => {
    wrap(
      <PortfolioFooter
        company={{
          ...company,
          snsLinks: ['https://instagram.com/houseon'],
          labels: { followUs: '인스타그램에서 보기', contact: false },
        }}
      />,
    );
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent('인스타그램에서 보기');
    expect(screen.queryByText('FOLLOW US')).toBeNull();
    expect(within(footer).getByRole('heading', { name: 'CONTACT' })).toHaveClass('sr-only');
  });
});

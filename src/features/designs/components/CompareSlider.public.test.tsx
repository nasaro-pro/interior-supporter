// CR-PF-04: 공개용 사본(src)·고정 비교(fixedPair)·라벨 — 기존 동작(fileId)은 CompareSlider.test.tsx 가 그대로 지킨다
import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CompareSlider,
  compareSrc,
  type CompareImage,
} from '@/features/designs/components/CompareSlider';

const ko = JSON.parse(readFileSync('messages/ko/designs.json', 'utf8'));

const pair: CompareImage[] = [
  {
    id: 'after',
    src: 'https://x.supabase.co/storage/v1/object/public/portfolio-public/c/w/after.webp',
    label: '애프터',
    designTitle: '거실',
    versionNo: null,
    pdfPage: null,
  },
  {
    id: 'before',
    src: 'https://x.supabase.co/storage/v1/object/public/portfolio-public/c/w/before.webp',
    label: '비포',
    designTitle: '거실',
    versionNo: null,
    pdfPage: null,
  },
];

function renderPublic(extra: Partial<Parameters<typeof CompareSlider>[0]> = {}) {
  return render(
    <NextIntlClientProvider locale="ko" messages={{ designs: ko }}>
      <CompareSlider
        images={pair}
        initialA="after"
        initialB="before"
        fixedPair
        sideLabels={{ a: '애프터', b: '비포' }}
        uiKey="portfolio-compare"
        {...extra}
      />
    </NextIntlClientProvider>,
  );
}

const settle = () =>
  act(async () => {
    await Promise.resolve();
  });

describe('CompareSlider — 공개용 사본', () => {
  const fetchSpy = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', fetchSpy));
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchSpy.mockReset();
  });

  it('src 가 있으면 그 주소를 그대로 쓰고 접근 확인 요청(fetch)을 보내지 않는다', async () => {
    renderPublic();
    await settle();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('compare-a')).toHaveAttribute('src', pair[0]!.src);
    expect(screen.getByTestId('compare-b')).toHaveAttribute('src', pair[1]!.src);
  });

  it('fixedPair 면 A/B 선택 상자를 숨기고, 라벨을 바꿔 보여 준다', async () => {
    renderPublic();
    await settle();
    for (const select of screen.queryAllByRole('combobox', { hidden: true })) {
      expect(select.closest('div')).toHaveClass('hidden');
    }
    expect(screen.getByText('애프터', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('비포', { selector: 'span' })).toBeInTheDocument();
  });

  it('키보드 조작과 data-ui-key 접두어가 그대로 동작한다', async () => {
    renderPublic();
    await settle();
    const handle = screen.getByRole('slider');
    expect(handle).toHaveAttribute('data-ui-key', 'portfolio-compare-handle');
    expect(handle).toHaveAttribute('aria-valuetext', '애프터 50% / 비포 50%');
    fireEvent.keyDown(handle, { key: 'End' });
    expect(handle).toHaveAttribute('aria-valuenow', '100');
  });

  it('공개 이미지가 깨지면 접근 불가가 아니라 로딩 실패(다시 시도)로 보인다', async () => {
    renderPublic();
    await settle();
    fireEvent.error(screen.getByTestId('compare-a'));
    expect(screen.getByRole('status')).toHaveTextContent(ko.compare.disabled.loadFailed);
    expect(screen.getByRole('button', { name: ko.compare.retry })).toBeInTheDocument();
  });
});

describe('compareSrc', () => {
  it('src 우선, 없으면 권한 재검사 파일 라우트', () => {
    expect(compareSrc({ ...pair[0]! })).toBe(pair[0]!.src);
    expect(
      compareSrc({ ...pair[0]!, src: undefined, fileId: '00000000-0000-4000-8000-000000000001' }),
    ).toBe('/api/files/00000000-0000-4000-8000-000000000001');
  });
});

describe('CompareSlider — 틀 채우기 (fit)', () => {
  it('기본은 contain(도안), 포트폴리오 사진은 cover — 비포·애프터 비율이 달라도 둘 다 꽉 채움', () => {
    renderPublic();
    expect(screen.getByTestId('compare-a')).toHaveClass('object-contain');
    cleanup();
    renderPublic({ fit: 'cover' });
    expect(screen.getByTestId('compare-a')).toHaveClass('object-cover');
    expect(screen.getByTestId('compare-b')).toHaveClass('object-cover');
  });
});

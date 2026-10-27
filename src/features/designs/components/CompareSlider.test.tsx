import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompareSlider, type CompareImage } from '@/features/designs/components/CompareSlider';

// 실제 문구 파일로 렌더링 (키 누락도 함께 드러난다)
const ko = JSON.parse(readFileSync('messages/ko/designs.json', 'utf8')) as {
  compare: {
    disabled: Record<'needTwo' | 'unselected' | 'loadFailed' | 'denied', string>;
    retry: string;
  };
};

const images: CompareImage[] = [
  {
    id: 'p1',
    fileId: '00000000-0000-4000-8000-000000000001',
    label: '거실 A안',
    designTitle: '평면도',
    versionNo: 1,
    pdfPage: null,
  },
  {
    id: 'p2',
    fileId: '00000000-0000-4000-8000-000000000002',
    label: '거실 B안',
    designTitle: '평면도',
    versionNo: 2,
    pdfPage: 3,
  },
];

function renderSlider(list: CompareImage[] = images) {
  return render(
    <NextIntlClientProvider locale="ko" messages={{ designs: ko }}>
      <CompareSlider images={list} />
    </NextIntlClientProvider>,
  );
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('TC-105 CompareSlider (B-T03·B-T04)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 0, type: 'opaqueredirect' }) as Response),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('D-06: 비교 영역은 화면 높이의 70% 를 넘지 않는다 (큰 모니터 넘침 방지)', async () => {
    renderSlider();
    await settle();
    expect(screen.getByTestId('compare-frame').className).toContain('max-h-[70svh]');
  });

  it('기본 50%, 키보드로 1%·10%·Home·End 조작, A 레이어 노출만 바뀐다', async () => {
    renderSlider();
    await settle();
    const handle = screen.getByRole('slider');
    const a = screen.getByTestId('compare-a');
    expect(handle).toHaveAttribute('aria-valuenow', '50');
    expect(handle).toHaveAttribute('aria-valuetext', 'A 50% / B 50%');
    expect(a.style.clipPath).toBe('inset(0 50% 0 0)');

    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(handle).toHaveAttribute('aria-valuenow', '51');
    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true });
    expect(handle).toHaveAttribute('aria-valuenow', '41');
    fireEvent.keyDown(handle, { key: 'Home' });
    expect(handle).toHaveAttribute('aria-valuenow', '0');
    expect(a.style.clipPath).toBe('inset(0 100% 0 0)'); // 0% = B 전체
    fireEvent.keyDown(handle, { key: 'End' });
    expect(handle).toHaveAttribute('aria-valuenow', '100');
    expect(a.style.clipPath).toBe('inset(0 0% 0 0)'); // 100% = A 전체
    // 이미지 크기는 고정 (object-contain + inset-0), 노출 영역만 바뀐다
    expect(a.className).toContain('object-contain');
    expect(a.className).toContain('inset-0');
  });

  it('이미지가 2개 미만이면 사유를 보이고 슬라이더를 그리지 않는다', async () => {
    renderSlider(images.slice(0, 1));
    await settle();
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(ko.compare.disabled.needTwo);
  });

  it('같은 이미지는 상대 쪽에서 고를 수 없다', async () => {
    renderSlider();
    await settle();
    const selects = screen.getAllByRole('combobox');
    const optionInB = selects[1]!.querySelector('option[value="p1"]') as HTMLOptionElement;
    expect(optionInB.disabled).toBe(true);
  });

  it('미선택이면 비활성 사유를 보인다', async () => {
    renderSlider();
    await settle();
    fireEvent.change(screen.getAllByRole('combobox')[1]!, { target: { value: '' } });
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(ko.compare.disabled.unselected);
  });

  it('로딩 실패 시 사유를 보이고, 실패한 쪽만 빠지며 다른 이미지는 계속 그린다 (B-03)', async () => {
    renderSlider();
    await settle();
    fireEvent.load(screen.getByTestId('compare-a'));
    fireEvent.error(screen.getByTestId('compare-b'));
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(ko.compare.disabled.loadFailed);
    expect(screen.queryByTestId('compare-b')).toBeNull();
    expect(screen.getByTestId('compare-a')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ko.compare.retry })).toBeInTheDocument();
  });

  it("'다시 시도' 는 실패한 이미지를 다시 마운트하고, 불러오면 슬라이더가 돌아온다 (B-03)", async () => {
    renderSlider();
    await settle();
    fireEvent.error(screen.getByTestId('compare-a'));
    expect(screen.queryByTestId('compare-a')).toBeNull();
    const fetchMock = vi.mocked(fetch);
    const probesBefore = fetchMock.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: ko.compare.retry }));
    await settle();
    const again = screen.getByTestId('compare-a');
    expect(again).toBeInTheDocument();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(probesBefore); // 접근 확인도 다시 한다
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.load(again);
    fireEvent.load(screen.getByTestId('compare-b'));
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('실패 후 다른 이미지를 골랐다가 다시 고르면 다시 불러온다 (B-03)', async () => {
    renderSlider();
    await settle();
    fireEvent.error(screen.getByTestId('compare-b'));
    const selectB = screen.getAllByRole('combobox')[1]!;
    fireEvent.change(selectB, { target: { value: '' } });
    fireEvent.change(selectB, { target: { value: 'p2' } });
    await settle();
    expect(screen.getByTestId('compare-b')).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('접근 확인이 네트워크 오류면 실패 → 재시도에서 확인 성공 시 회복한다 (B-03)', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValue({ ok: false, status: 0, type: 'opaqueredirect' } as Response);
    vi.stubGlobal('fetch', fetchMock);
    renderSlider();
    await settle();
    await settle();
    expect(screen.getByRole('status')).toHaveTextContent(ko.compare.disabled.loadFailed);
    fireEvent.click(screen.getByRole('button', { name: ko.compare.retry }));
    await settle();
    await settle();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByTestId('compare-a')).toBeInTheDocument();
    expect(screen.getByTestId('compare-b')).toBeInTheDocument();
  });

  it('비로그인·권한 없음(404)은 재시도 버튼 없이 접근 불가 사유', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, type: 'basic' }) as Response),
    );
    renderSlider();
    await settle();
    await settle();
    expect(screen.getByRole('status')).toHaveTextContent(ko.compare.disabled.denied);
    expect(screen.queryByRole('button', { name: ko.compare.retry })).toBeNull();
    expect(screen.queryByTestId('compare-a')).toBeNull();
  });

  it('접근 불가(404)면 사유를 보인다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, type: 'basic' }) as Response),
    );
    renderSlider();
    await settle();
    await settle();
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(ko.compare.disabled.denied);
  });
});

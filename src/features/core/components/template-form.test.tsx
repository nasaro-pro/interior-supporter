// REQ-052 TemplateForm (CR-A-10) — 미리보기 즉시 반영 · 페이지별 이미지·분위기 · 저장 값 · 충돌 시 입력 보존
import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const updateTemplate = vi.fn();
vi.mock('../server/company-actions', () => ({
  setCompanyLogo: vi.fn(),
  updateCompany: vi.fn(),
  updateTemplate: (...a: unknown[]) => updateTemplate(...a),
}));
vi.mock('../server/participant-actions', () => ({
  changeMemberRole: vi.fn(),
  createMemberInvite: vi.fn(),
}));
vi.mock('../server/auth-actions', () => ({ createPasswordResetLink: vi.fn() }));
vi.mock('@/features/files', () => ({ createUploadIntent: vi.fn(), finalizeUpload: vi.fn() }));
vi.mock('@/shared/lib/supabase/browser', () => ({ createBrowserSupabase: vi.fn() }));

import { DEFAULT_HOME_SECTIONS } from '../home-sections';
import { TemplateForm } from './settings-forms';

const read = (ns: string) => JSON.parse(readFileSync(`messages/ko/${ns}.json`, 'utf8'));
const messages = Object.fromEntries(
  ['settings', 'projects', 'common', 'errors', 'files', 'history'].map((ns) => [ns, read(ns)]),
);
const CO = '00000000-0000-4000-8000-0000000000c1';
const IMG = '00000000-0000-4000-8000-0000000000e1';
const IMG2 = '00000000-0000-4000-8000-0000000000e2';

const ui = (version = 2, pageImages: Record<string, string> = { home: IMG, photos: IMG2 }) => (
  <NextIntlClientProvider locale="ko" messages={messages}>
    <TemplateForm
      companyId={CO}
      version={version}
      value={{
        homeMessage: '기본 안내',
        homeSections: DEFAULT_HOME_SECTIONS,
        homeTheme: 'brand',
        pageImages,
        pageTone: 'default',
      }}
    />
  </NextIntlClientProvider>
);
const byKey = (k: string) => document.querySelector(`[data-ui-key="${k}"]`) as HTMLElement;
const canvas = () => byKey('page-canvas');
const previewImage = () =>
  (document.querySelector('[data-ui-key="page-image"]') as HTMLElement | null)?.style
    .backgroundImage ?? '';
const previewTab = (name: string) =>
  screen.getByRole('button', { name, pressed: false }) as HTMLElement;
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('REQ-052 TemplateForm', () => {
  it('정상: 분위기·안내문·테마·영역을 바꾸면 미리보기에 바로 보이고, 저장 시 전체를 보낸다', async () => {
    updateTemplate.mockResolvedValueOnce({ ok: true, data: { version: 3 } });
    render(ui());
    fireEvent.click(screen.getByLabelText('세이지'));
    fireEvent.change(screen.getByLabelText('고객 홈 기본 안내문'), {
      target: { value: '새 안내' },
    });
    fireEvent.click(screen.getByLabelText('파랑'));
    fireEvent.click(
      document.querySelectorAll('[data-ui-key="home-section-visible-toggle"]')[1] as HTMLElement,
    );
    expect(canvas().dataset.tone).toBe('sage');
    expect(previewImage()).toContain(IMG);
    const message = document.querySelector('[data-theme-key]') as HTMLElement;
    expect(message.dataset.themeKey).toBe('info');
    expect(message).toHaveTextContent('새 안내');
    await act(async () => {
      fireEvent.click(byKey('template-submit'));
      await flush();
    });
    expect(updateTemplate).toHaveBeenCalledWith({
      companyId: CO,
      baseVersion: 2,
      defaultHomeMessage: '새 안내',
      defaultHomeSections: DEFAULT_HOME_SECTIONS.map((s) =>
        s.key === 'recent' ? { ...s, visible: false } : s,
      ),
      defaultHomeTheme: 'info',
      defaultPageImages: { home: IMG, photos: IMG2 },
      defaultPageTone: 'sage',
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('정상: 미리볼 페이지를 바꾸면 그 페이지 이미지로, 이미지 없는 페이지는 분위기 색만', () => {
    render(ui());
    fireEvent.click(previewTab('현장 사진'));
    expect(previewImage()).toContain(IMG2);
    expect(screen.getByText('현장 사진 내용이 이 자리에 표시됩니다.')).toBeInTheDocument();
    fireEvent.click(previewTab('도안'));
    expect(previewImage()).toBe('');
  });

  it('정상: 페이지 이미지 제거는 그 페이지만 빠지고 저장에 반영된다', async () => {
    updateTemplate.mockResolvedValueOnce({ ok: true, data: { version: 3 } });
    render(ui());
    fireEvent.click(screen.getByRole('button', { name: '홈 이미지 제거' }));
    expect(previewImage()).toBe('');
    await act(async () => {
      fireEvent.click(byKey('template-submit'));
      await flush();
    });
    expect(updateTemplate).toHaveBeenLastCalledWith(
      expect.objectContaining({ defaultPageImages: { photos: IMG2 } }),
    );
  });

  it('예외: 충돌 → 최신 불러오기 후 입력을 유지하고 새 version 으로 저장', async () => {
    updateTemplate
      .mockResolvedValueOnce({ ok: false, error: { code: 'VERSION_CONFLICT' } })
      .mockResolvedValueOnce({ ok: true, data: { version: 6 } });
    const view = render(ui(4));
    fireEvent.click(screen.getByLabelText('클레이'));
    await act(async () => {
      fireEvent.click(byKey('template-submit'));
      await flush();
    });
    await act(async () => {
      fireEvent.click(byKey('template-reload'));
    });
    view.rerender(ui(5));
    await act(async () => {
      fireEvent.click(byKey('template-submit'));
      await flush();
    });
    expect(updateTemplate).toHaveBeenLastCalledWith(
      expect.objectContaining({ baseVersion: 5, defaultPageTone: 'clay' }),
    );
  });

  it('권한 거부: 서버가 FORBIDDEN 을 돌려주면 오류를 보이고 입력은 남는다', async () => {
    updateTemplate.mockResolvedValueOnce({ ok: false, error: { code: 'FORBIDDEN' } });
    render(ui(2, {}));
    expect(byKey('page-canvas')).toBeNull();
    fireEvent.change(screen.getByLabelText('고객 홈 기본 안내문'), {
      target: { value: '남아야 함' },
    });
    await act(async () => {
      fireEvent.click(byKey('template-submit'));
      await flush();
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByDisplayValue('남아야 함')).toBeInTheDocument();
  });
});

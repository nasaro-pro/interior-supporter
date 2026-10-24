// REQ-052 TemplateForm (CR-A-10) — 미리보기 즉시 반영 · 저장 값 · 충돌 시 입력 보존 · 배경 제거
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
const COVER = '00000000-0000-4000-8000-0000000000e1';

const ui = (version = 2, background: string | null = COVER) => (
  <NextIntlClientProvider locale="ko" messages={messages}>
    <TemplateForm
      companyId={CO}
      version={version}
      value={{
        homeMessage: '기본 안내',
        homeSections: DEFAULT_HOME_SECTIONS,
        homeTheme: 'brand',
        homeBackgroundFileId: background,
      }}
    />
  </NextIntlClientProvider>
);
const byKey = (k: string) => document.querySelector(`[data-ui-key="${k}"]`) as HTMLElement;
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('REQ-052 TemplateForm', () => {
  it('정상: 안내문·테마·영역을 바꾸면 미리보기에 바로 보이고, 저장 시 4종을 보낸다', async () => {
    updateTemplate.mockResolvedValueOnce({ ok: true, data: { version: 3 } });
    render(ui());
    fireEvent.change(screen.getByLabelText('고객 홈 기본 안내문'), {
      target: { value: '새 안내' },
    });
    fireEvent.click(screen.getByLabelText('파랑'));
    fireEvent.click(
      document.querySelectorAll('[data-ui-key="home-section-visible-toggle"]')[1] as HTMLElement,
    );
    const preview = document.querySelector('[data-theme-key]') as HTMLElement;
    expect(preview.dataset.themeKey).toBe('info');
    expect(preview).toHaveTextContent('새 안내');
    expect(document.querySelector('[data-ui-key="home-background"]')).not.toBeNull();
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
      defaultHomeBackgroundFileId: COVER,
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('정상: 배경 제거는 미리보기에서 사라지고 null 로 저장된다', async () => {
    updateTemplate.mockResolvedValueOnce({ ok: true, data: { version: 3 } });
    render(ui());
    fireEvent.click(byKey('template-background-remove'));
    expect(document.querySelector('[data-ui-key="home-background"]')).toBeNull();
    await act(async () => {
      fireEvent.click(byKey('template-submit'));
      await flush();
    });
    expect(updateTemplate).toHaveBeenLastCalledWith(
      expect.objectContaining({ defaultHomeBackgroundFileId: null }),
    );
  });

  it('예외: 충돌 → 최신 불러오기 후 입력을 유지하고 새 version 으로 저장', async () => {
    updateTemplate
      .mockResolvedValueOnce({ ok: false, error: { code: 'VERSION_CONFLICT' } })
      .mockResolvedValueOnce({ ok: true, data: { version: 6 } });
    const view = render(ui(4));
    fireEvent.click(screen.getByLabelText('초록'));
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
      expect.objectContaining({ baseVersion: 5, defaultHomeTheme: 'positive' }),
    );
  });

  it('권한 거부: 서버가 FORBIDDEN 을 돌려주면 오류를 보이고 입력은 남는다', async () => {
    updateTemplate.mockResolvedValueOnce({ ok: false, error: { code: 'FORBIDDEN' } });
    render(ui(2, null));
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

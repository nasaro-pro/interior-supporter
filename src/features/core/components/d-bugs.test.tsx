// 디자이너 페이지 1단계 — D-01 로그인 실패 후 입력 유지·칸 표시 / D-02 빈 화면 '생성' 링크(?mode=new)로 Sheet 열림
import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let search = new URLSearchParams();
const replace = vi.fn((href: string) => {
  search = new URLSearchParams(href.split('?')[1] ?? '');
});
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/app/studio/projects',
  useSearchParams: () => search,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const login = vi.fn();
vi.mock('../server/session-actions', () => ({
  login: (...a: unknown[]) => login(...a),
  resetPassword: vi.fn(),
}));
vi.mock('../server/auth-actions', () => ({
  acceptInvitationAsCurrentUser: vi.fn(),
  acceptInvitationWithNewAccount: vi.fn(),
  signupCompany: vi.fn(),
}));
vi.mock('../server/project-actions', () => ({ createProject: vi.fn(), updateProject: vi.fn() }));

import { LoginForm } from './auth-forms';
import { ProjectCreateSheet } from './project-forms';

const read = (ns: string) => JSON.parse(readFileSync(`messages/ko/${ns}.json`, 'utf8'));
const messages = {
  common: read('common'),
  errors: read('errors'),
  auth: read('auth'),
  projects: read('projects'),
};
const wrap = (node: ReactNode) => (
  <NextIntlClientProvider locale="ko" messages={messages}>
    {node}
  </NextIntlClientProvider>
);

beforeEach(() => {
  search = new URLSearchParams();
  vi.clearAllMocks();
});
afterEach(() => cleanup());

describe('D-01 로그인 실패 후 입력 유지', () => {
  it('인증 실패면 이메일·비밀번호가 남고 두 칸 모두 aria-invalid', async () => {
    login.mockResolvedValue({ ok: false, error: { code: 'UNAUTHENTICATED' } });
    const user = userEvent.setup();
    render(wrap(<LoginForm />));
    const email = screen.getByLabelText(new RegExp(messages.auth.field.email)) as HTMLInputElement;
    const pw = screen.getByLabelText(new RegExp(messages.auth.field.password)) as HTMLInputElement;
    await user.type(email, 'pm1@test.local');
    await user.type(pw, 'wrong-password');
    await user.click(screen.getByRole('button', { name: messages.auth.login.submit }));
    expect(await screen.findByText(messages.auth.login.failed)).toBeInTheDocument();
    expect(email.value).toBe('pm1@test.local');
    expect(pw.value).toBe('wrong-password');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(pw).toHaveAttribute('aria-invalid', 'true');
  });

  it('형식 오류는 해당 칸만 aria-invalid', async () => {
    login.mockResolvedValue({
      ok: false,
      error: { code: 'VALIDATION', fieldErrors: { email: ['field.email'] } },
    });
    const user = userEvent.setup();
    render(wrap(<LoginForm />));
    const email = screen.getByLabelText(new RegExp(messages.auth.field.email)) as HTMLInputElement;
    const pw = screen.getByLabelText(new RegExp(messages.auth.field.password)) as HTMLInputElement;
    await user.type(email, 'not-an-email');
    await user.type(pw, 'whatever123');
    await user.click(screen.getByRole('button', { name: messages.auth.login.submit }));
    await act(async () => {});
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(pw).not.toHaveAttribute('aria-invalid');
    expect(email.value).toBe('not-an-email');
  });
});

describe('D-02 프로젝트 생성 Sheet 와 ?mode=new 동기화', () => {
  it('주소에 mode=new 가 있으면 열려 있다 (빈 화면 링크·새로고침)', () => {
    search = new URLSearchParams('mode=new');
    render(wrap(<ProjectCreateSheet companySlug="studio" />));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('버튼으로 열면 mode=new, 닫으면 mode 를 지운다', async () => {
    const user = userEvent.setup();
    const { rerender } = render(wrap(<ProjectCreateSheet companySlug="studio" />));
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: messages.projects.list.create }));
    expect(replace).toHaveBeenLastCalledWith('/app/studio/projects?mode=new', { scroll: false });
    rerender(wrap(<ProjectCreateSheet companySlug="studio" />));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(replace).toHaveBeenLastCalledWith('/app/studio/projects', { scroll: false });
  });
});

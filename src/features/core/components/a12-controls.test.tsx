// A-12 — MemberRoleSelect(확인 후 변경·취소 시 유지·실패 시 되돌림) · ProjectSwitcher(보관된 현재 프로젝트 표시)
import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push }),
  useSelectedLayoutSegment: () => null,
}));
const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
  },
}));
const changeMemberRole = vi.fn();
vi.mock('../server/participant-actions', () => ({
  changeMemberRole: (...a: unknown[]) => changeMemberRole(...a),
  createMemberInvite: vi.fn(),
}));
vi.mock('../server/company-actions', () => ({
  setCompanyLogo: vi.fn(),
  updateCompany: vi.fn(),
  updateTemplate: vi.fn(),
}));
vi.mock('../server/auth-actions', () => ({ createPasswordResetLink: vi.fn() }));
vi.mock('@/features/files', () => ({ createUploadIntent: vi.fn(), finalizeUpload: vi.fn() }));
vi.mock('@/shared/lib/supabase/browser', () => ({ createBrowserSupabase: vi.fn() }));

import { MemberRoleSelect } from './settings-forms';
import { ProjectSwitcher } from './project-shell';

const read = (ns: string) => JSON.parse(readFileSync(`messages/ko/${ns}.json`, 'utf8'));
const messages = {
  common: read('common'),
  errors: read('errors'),
  settings: read('settings'),
  projects: read('projects'),
};
const renderKo = (node: ReactNode) =>
  render(
    <NextIntlClientProvider locale="ko" messages={messages}>
      {node}
    </NextIntlClientProvider>,
  );
const byKey = (k: string) => document.querySelector<HTMLElement>(`[data-ui-key="${k}"]`)!;

afterEach(cleanup);
beforeEach(() => {
  refresh.mockReset();
  push.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
  changeMemberRole.mockReset();
});

const props = { companyId: 'c1', memberId: 'm1', version: 3, role: 'pm' as const, name: '김PM' };

describe('MemberRoleSelect (A-12)', () => {
  it('바꾸면 확인 대화상자 → 취소하면 원래 값 유지, 서버 호출 없음', async () => {
    renderKo(<MemberRoleSelect {...props} />);
    const select = byKey('member-role-select') as HTMLSelectElement;
    await userEvent.selectOptions(select, 'manager');
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('김PM님의 역할을 바꿀까요?');
    // 비파괴 동작 → 기본 버튼
    expect(byKey('member-role-change-confirm').className).not.toContain('bg-destructive');
    await userEvent.click(byKey('member-role-change-cancel'));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(select.value).toBe('pm');
    expect(changeMemberRole).not.toHaveBeenCalled();
  });

  it('확인 → 성공하면 새 값 + toast + refresh', async () => {
    changeMemberRole.mockResolvedValue({ ok: true, data: { version: 4 } });
    renderKo(<MemberRoleSelect {...props} />);
    const select = byKey('member-role-select') as HTMLSelectElement;
    await userEvent.selectOptions(select, 'manager');
    await userEvent.click(await waitFor(() => byKey('member-role-change-confirm')));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(changeMemberRole).toHaveBeenCalledWith({
      companyId: 'c1',
      memberId: 'm1',
      baseVersion: 3,
      role: 'manager',
    });
    expect(select.value).toBe('manager');
    expect(toastSuccess).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it('확인 → 실패하면 원래 값으로 되돌리고 오류 toast', async () => {
    changeMemberRole.mockResolvedValue({
      ok: false,
      error: { code: 'VERSION_CONFLICT', ref: 'r1' },
    });
    renderKo(<MemberRoleSelect {...props} />);
    const select = byKey('member-role-select') as HTMLSelectElement;
    await userEvent.selectOptions(select, 'manager');
    await userEvent.click(await waitFor(() => byKey('member-role-change-confirm')));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(select.value).toBe('pm');
    expect(toastError).toHaveBeenCalled();
  });
});

describe('ProjectSwitcher (A-12)', () => {
  const options = [
    { id: 'p2', name: '두 번째', href: '/p2' },
    { id: 'p3', name: '세 번째', href: '/p3' },
  ];
  it('현재 프로젝트가 보관돼 목록에 없으면 맨 앞에 "(보관) 이름" 을 선택된 값으로', () => {
    renderKo(
      <ProjectSwitcher current="p1" currentName="첫 번째" currentArchived options={options} />,
    );
    const select = byKey('project-switcher-select') as HTMLSelectElement;
    expect(select.value).toBe('p1');
    expect(select.options[0]).toHaveTextContent('(보관) 첫 번째');
    expect(select.options).toHaveLength(3);
  });

  it('목록에 있으면 추가 항목 없음, 다른 항목 선택 시 이동', async () => {
    renderKo(<ProjectSwitcher current="p2" currentName="두 번째" options={options} />);
    const select = byKey('project-switcher-select') as HTMLSelectElement;
    expect(select.options).toHaveLength(2);
    await userEvent.selectOptions(select, 'p3');
    expect(push).toHaveBeenCalledWith('/p3');
  });

  it('보관된 현재 + 다른 프로젝트 1개면 그린다, 이름이 없으면 그리지 않는다', () => {
    const one = options.slice(0, 1);
    const { unmount } = renderKo(
      <ProjectSwitcher current="p1" currentName="첫 번째" currentArchived options={one} />,
    );
    expect(byKey('project-switcher-select')).not.toBeNull();
    unmount();
    renderKo(<ProjectSwitcher current="p1" options={one} />);
    expect(document.querySelector('[data-ui-key="project-switcher-select"]')).toBeNull();
  });
});

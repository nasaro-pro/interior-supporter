// A-06: VERSION_CONFLICT 화면 고착·baseVersion 회귀 방지 (ProjectBasicsForm · HomeEditor)
import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, replace }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./server/project-actions', () => ({
  updateProject: vi.fn(),
  updateHome: vi.fn(),
  createProject: vi.fn(),
}));

import { updateHome, updateProject } from './server/project-actions';
import { ProjectBasicsForm, _basicsDraftFor } from './components/project-forms';
import { HomeEditor } from './components/home-editor';
import { DEFAULT_HOME_SECTIONS } from './home-sections';
import type { ProjectDetail } from './types';

const read = (ns: string) => JSON.parse(readFileSync(`messages/ko/${ns}.json`, 'utf8'));
const messages = { projects: read('projects'), common: read('common'), errors: read('errors') };

const PID = '00000000-0000-4000-8000-0000000000f1';
const project = (over: Partial<ProjectDetail> = {}): ProjectDetail => ({
  id: PID,
  companyId: 'c',
  name: '원래 이름',
  siteAddress: '서울',
  startDate: null,
  endDate: null,
  status: 'active',
  currentPhase: '철거',
  isPublic: false,
  homeMessage: '안내',
  homeSections: DEFAULT_HOME_SECTIONS,
  homeTheme: 'brand',
  pageImages: {},
  pageTone: 'default',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  archivedAt: null,
  version: 1,
  ...over,
});

const wrap = (node: React.ReactNode) => (
  <NextIntlClientProvider locale="ko" messages={messages}>
    {node}
  </NextIntlClientProvider>
);

function byKey(key: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-ui-key="${key}"]`);
  if (!el) throw new Error(`no element ${key}`);
  return el;
}
const baseVersionValue = () =>
  document.querySelector<HTMLInputElement>('input[name="baseVersion"]')?.value;

async function submitBasics() {
  await act(async () => {
    fireEvent.click(byKey('project-basics-submit'));
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('A-06 ProjectBasicsForm', () => {
  it('정상: 저장 성공 뒤 검증 오류가 나도 baseVersion 이 이전 값으로 돌아가지 않는다', async () => {
    vi.mocked(updateProject)
      .mockResolvedValueOnce({ ok: true, data: { version: 2 } })
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'VALIDATION_FAILED', fieldErrors: { name: ['field.required'] } },
      });
    render(wrap(<ProjectBasicsForm project={project()} />));
    expect(baseVersionValue()).toBe('1');
    await submitBasics();
    expect(baseVersionValue()).toBe('2');
    await submitBasics();
    expect(baseVersionValue()).toBe('2'); // 예전 코드는 여기서 1 로 회귀 → 가짜 충돌
    expect(refresh).toHaveBeenCalled();
  });

  it('예외: 충돌 → 안내 + 최신 불러오기 → 새 버전 인스턴스(key)가 사용자 입력을 채우고 새 version 으로 저장', async () => {
    vi.mocked(updateProject)
      .mockResolvedValueOnce({ ok: false, error: { code: 'VERSION_CONFLICT' } })
      .mockResolvedValueOnce({ ok: true, data: { version: 4 } });
    const view = render(wrap(<ProjectBasicsForm key={1} project={project()} />));
    fireEvent.change(screen.getByDisplayValue('원래 이름'), {
      target: { value: '내가 고친 이름' },
    });
    await submitBasics();
    expect(screen.queryByDisplayValue('내가 고친 이름')).toBeNull(); // 충돌 안내 화면
    expect(byKey('project-basics-reload')).toBeInTheDocument();
    expect(_basicsDraftFor(PID)?.name).toBe('내가 고친 이름');

    await act(async () => {
      fireEvent.click(byKey('project-basics-reload'));
    });
    expect(refresh).toHaveBeenCalled();
    // 서버가 다른 사람이 바꾼 최신(version 3)으로 다시 그린다 — 부모 key 변경
    view.rerender(
      wrap(<ProjectBasicsForm key={3} project={project({ name: '남이 바꾼 이름', version: 3 })} />),
    );
    expect(screen.getByDisplayValue('내가 고친 이름')).toBeInTheDocument();
    expect(baseVersionValue()).toBe('3');
    expect(_basicsDraftFor(PID)).toBeUndefined(); // 한 번 쓰고 지움

    await submitBasics();
    const sent = vi.mocked(updateProject).mock.calls.at(-1)?.[1] as FormData;
    expect(sent.get('baseVersion')).toBe('3');
    expect(sent.get('name')).toBe('내가 고친 이름');
  });

  it('예외: 최신 불러오기 후 버전이 그대로여도(같은 인스턴스) 충돌 화면에 갇히지 않는다', async () => {
    vi.mocked(updateProject).mockResolvedValueOnce({
      ok: false,
      error: { code: 'VERSION_CONFLICT' },
    });
    render(wrap(<ProjectBasicsForm key={1} project={project()} />));
    fireEvent.change(screen.getByDisplayValue('원래 이름'), { target: { value: '입력 유지' } });
    await submitBasics();
    await act(async () => {
      fireEvent.click(byKey('project-basics-reload'));
    });
    expect(screen.getByDisplayValue('입력 유지')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('A-06 HomeEditor', () => {
  const ui = (version: number) =>
    wrap(
      <HomeEditor
        projectId={PID}
        version={version}
        homeMessage="안내"
        homeSections={DEFAULT_HOME_SECTIONS}
        homeTheme="brand"
        pageImages={{}}
        pageTone="default"
        doneHref="/done"
      />,
    );

  it('예외: 충돌 → 최신 불러오기는 오류를 지우고 입력을 유지, 새 version 으로 저장', async () => {
    vi.mocked(updateHome)
      .mockResolvedValueOnce({ ok: false, error: { code: 'VERSION_CONFLICT' } })
      .mockResolvedValueOnce({ ok: true, data: { version: 6 } });
    const view = render(ui(4));
    fireEvent.change(screen.getByDisplayValue('안내'), { target: { value: '새 안내문' } });
    await act(async () => {
      fireEvent.click(byKey('home-editor-save'));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(byKey('home-editor-reload')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(byKey('home-editor-reload'));
    });
    expect(refresh).toHaveBeenCalled();
    view.rerender(ui(5));
    expect(screen.getByDisplayValue('새 안내문')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(byKey('home-editor-save'));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(updateHome).toHaveBeenLastCalledWith(
      expect.objectContaining({ baseVersion: 5, homeMessage: '새 안내문' }),
    );
    expect(replace).toHaveBeenCalledWith('/done');
  });
});

// D-31 · D-32 · D-33 메모 — 자동 제목 · 연결 항목 저장 · 항목 메모 조회 · 미답변 판정 · 대화형 표시
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createSupabaseFake } from '@/features/requests/testing';

vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { rich: (key: string) => key }),
  useLocale: () => 'ko',
}));
vi.mock('@/features/core', () => ({ requireProjectAccess: vi.fn(), getAccessContext: vi.fn() }));
vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/shared/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  newRef: () => 'ref1234567',
}));

import { getAccessContext, requireProjectAccess } from '@/features/core';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { createRequest } from './server/actions';
import { listItemMemos } from './server/queries';
import { countUnansweredRequests } from './server/summary';
import { autoTitle, isUnanswered } from './lib/memo';
import { RequestThread } from './components/RequestThread';

const projectId = '7a9b8c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const id = '3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f';
const designId = '6f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f';
const customer = {
  projectId,
  companyId: 'c1',
  companySlug: 'studio',
  as: 'customer' as const,
  canConfirm: false,
};
const editor = { ...customer, as: 'editor' as const };

function useFake(script: Parameters<typeof createSupabaseFake>[0]) {
  const fake = createSupabaseFake(script);
  vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
  return fake;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireProjectAccess).mockResolvedValue(customer);
  vi.mocked(getAccessContext).mockResolvedValue({
    userId: 'u1',
    displayName: '고객1',
    locale: 'ko',
    memberships: [],
    participations: [],
    areas: ['portal'],
  });
});

describe('autoTitle (D-33)', () => {
  it('본문 첫 줄 앞 40자 + 말줄임, 공백 정리', () => {
    expect(autoTitle('  \n거실   조명이\t어두워요\n둘째 줄')).toBe('거실 조명이 어두워요');
    expect(autoTitle('가'.repeat(50))).toBe(`${'가'.repeat(40)}…`);
  });
});

describe('createRequest 메모 (D-32 · D-33)', () => {
  it('제목 없이 도안에 메모 → 자동 제목 + 연결 항목 저장, 도안 상세도 갱신', async () => {
    const fake = useFake({ requests: [{ error: null }] });
    const res = await createRequest({
      id,
      projectId,
      body: '타일 색을 더 밝게',
      targetType: 'designs',
      targetId: designId,
    });
    expect(res).toEqual({ ok: true, data: { id } });
    expect(fake.argOf('requests', 'insert')?.[0]).toMatchObject({
      title: '타일 색을 더 밝게',
      target_type: 'designs',
      target_id: designId,
    });
    expect(revalidatePath).toHaveBeenCalledWith(
      `/portal/projects/${projectId}/designs/${designId}`,
    );
  });

  it('비공개 · 보관 · 다른 프로젝트 항목(DB invalid_target) → targetId 필드 오류', async () => {
    useFake({ requests: [{ error: { code: 'P0001', message: 'invalid_target' } }] });
    const res = await createRequest({
      id,
      projectId,
      body: 'x',
      targetType: 'materials',
      targetId: designId,
    });
    expect(res).toEqual({
      ok: false,
      error: { code: 'VALIDATION_FAILED', fieldErrors: { targetId: ['field.invalid'] } },
    });
  });

  it('권한 거부: 편집자는 메모를 만들 수 없다 (고객 전용)', async () => {
    vi.mocked(requireProjectAccess).mockRejectedValue(new Error('NEXT_NOT_FOUND'));
    const fake = useFake({});
    await expect(createRequest({ id, projectId, body: 'x' })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(fake.opsOf('requests')).toHaveLength(0);
  });
});

describe('listItemMemos (D-32)', () => {
  const row = {
    id,
    body: '원문',
    status: 'open',
    author_id: 'u1',
    created_at: '2026-10-25T01:00:00Z',
  };

  it('고객은 본인 메모만 묻고(이중 검증), 정정 · 답변을 시각순 대화로 묶는다', async () => {
    const fake = useFake({
      requests: [{ data: [row] }],
      request_corrections: [{ data: [] }],
      request_replies: [
        {
          data: [
            {
              id: 'r1',
              request_id: id,
              body: '확인했어요',
              author_id: 'pm1',
              created_at: '2026-10-25T02:00:00Z',
            },
          ],
        },
      ],
      profiles: [{ data: [{ id: 'u1', display_name: '고객1' }] }],
    });
    const memos = await listItemMemos(projectId, customer, 'u1', 'designs', designId);
    expect(memos).toHaveLength(1);
    expect(memos[0]!.entries.map((e) => e.kind)).toEqual(['original', 'reply']);
    const ops = fake.opsOf('requests');
    expect(ops).toEqual(
      expect.arrayContaining([
        { op: 'eq', args: ['target_type', 'designs'] },
        { op: 'eq', args: ['target_id', designId] },
        { op: 'eq', args: ['author_id', 'u1'] },
        { op: 'is', args: ['archived_at', null] },
      ]),
    );
  });

  it('편집자는 작성자 조건 없이 전체, 메모가 없으면 빈 목록 (하위 조회 없음)', async () => {
    const fake = useFake({ requests: [{ data: [] }] });
    expect(await listItemMemos(projectId, editor, 'pm1', 'materials', designId)).toEqual([]);
    expect(fake.opsOf('requests')).not.toContainEqual({ op: 'eq', args: ['author_id', 'pm1'] });
    expect(fake.opsOf('request_replies')).toHaveLength(0);
  });

  it('시공팀은 메모를 보지 않는다 (DB 를 묻지 않음)', async () => {
    const fake = useFake({});
    expect(
      await listItemMemos(projectId, { ...customer, as: 'field' }, 'f1', 'designs', designId),
    ).toEqual([]);
    expect(fake.opsOf('requests')).toHaveLength(0);
  });
});

describe('미답변 (D-31)', () => {
  const base = { created_at: '2026-10-25T01:00:00Z', request_corrections: [], request_replies: [] };
  it('답변이 없으면 미답변, 답변 뒤 고객이 정정하면 다시 미답변', () => {
    expect(isUnanswered(base)).toBe(true);
    expect(
      isUnanswered({ ...base, request_replies: [{ created_at: '2026-10-25T02:00:00Z' }] }),
    ).toBe(false);
    expect(
      isUnanswered({
        ...base,
        request_replies: [{ created_at: '2026-10-25T02:00:00Z' }],
        request_corrections: [{ created_at: '2026-10-25T03:00:00Z' }],
      }),
    ).toBe(true);
  });

  it('countUnansweredRequests: 보관 · 해결 제외 조건으로 묻고 미답변만 센다, 실패는 null', async () => {
    let fake = useFake({
      requests: [
        {
          data: [
            base,
            { ...base, request_replies: [{ created_at: '2026-10-25T02:00:00Z' }] },
            { ...base, request_corrections: [{ created_at: '2026-10-25T04:00:00Z' }] },
          ],
        },
      ],
    });
    expect(await countUnansweredRequests('c1')).toBe(2);
    expect(fake.opsOf('requests')).toEqual(
      expect.arrayContaining([
        { op: 'eq', args: ['company_id', 'c1'] },
        { op: 'is', args: ['archived_at', null] },
        { op: 'neq', args: ['status', 'resolved'] },
      ]),
    );
    fake = useFake({ requests: [{ error: { code: '42501' } }] });
    expect(await countUnansweredRequests('c1')).toBeNull();
  });
});

describe('RequestThread 대화형 (D-33)', () => {
  const entries = [
    {
      kind: 'original' as const,
      id: 'o',
      body: '원문',
      authorId: 'u1',
      authorName: '고객1',
      createdAt: '2026-10-25T01:00:00Z',
    },
    {
      kind: 'reply' as const,
      id: 'r',
      body: '답변',
      authorId: 'p',
      authorName: 'PM',
      createdAt: '2026-10-25T02:00:00Z',
    },
  ];
  it('디자이너 화면: 답변이 내 쪽(오른쪽), 고객 화면: 원문이 내 쪽', () => {
    const { unmount } = render(<RequestThread entries={entries} perspective="editor" />);
    let list = screen.getByRole('list');
    expect(within(list).getByText('답변').closest('li')?.dataset.side).toBe('mine');
    expect(within(list).getByText('원문').closest('li')?.dataset.side).toBe('theirs');
    unmount();
    render(<RequestThread entries={entries} perspective="customer" />);
    list = screen.getByRole('list');
    expect(within(list).getByText('원문').closest('li')?.dataset.side).toBe('mine');
  });
});

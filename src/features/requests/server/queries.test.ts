// C-01 — 요청 상세의 고객 author_id 이중 검증 (목록·summary 와 같은 조건)
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFake } from '@/features/requests/testing';

vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { countItemMemos, getRequestDetail } from './queries';

const projectId = '7a9b8c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const viewer = (as: 'editor' | 'customer') => ({
  projectId,
  companyId: 'c1',
  companySlug: 'studio',
  as,
  canConfirm: false,
});
const request = (authorId: string) => ({
  id: 'r1',
  project_id: projectId,
  title: '타일 색',
  body: '밝게',
  status: 'open',
  version: 1,
  author_id: authorId,
  created_at: '2026-10-07T00:00:00Z',
  archived_at: null,
});

function useFake(script: Parameters<typeof createSupabaseFake>[0]) {
  const fake = createSupabaseFake(script);
  vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
  return fake;
}

beforeEach(() => vi.clearAllMocks());

describe('getRequestDetail (CL-16 · PM-16, C-01)', () => {
  it('정상: 작성 고객 본인은 상세를 받고, 쿼리에 author_id 조건이 붙는다', async () => {
    const fake = useFake({
      requests: [{ data: request('u1') }],
      request_corrections: [{ data: [] }],
      request_replies: [{ data: [] }],
      profiles: [{ data: [{ id: 'u1', display_name: '고객1' }] }],
    });
    const detail = await getRequestDetail(projectId, 'r1', viewer('customer'), 'u1');
    expect(detail).toMatchObject({
      id: 'r1',
      authorName: '고객1',
      entries: [{ kind: 'original' }],
    });
    expect(fake.opsOf('requests')).toContainEqual({ op: 'eq', args: ['author_id', 'u1'] });
  });

  it('권한: 다른 고객(U2)이 U1 요청 id 로 열면 null → 404 (C-T02)', async () => {
    const fake = useFake({ requests: [{ data: null }] });
    expect(await getRequestDetail(projectId, 'r1', viewer('customer'), 'u2')).toBeNull();
    expect(fake.opsOf('requests')).toContainEqual({ op: 'eq', args: ['author_id', 'u2'] });
    expect(fake.calls.some((c) => c.table === 'request_replies')).toBe(false);
  });

  it('권한: RLS 가 남의 행을 돌려줘도 고객에게는 null (앱 이중 검증)', async () => {
    useFake({ requests: [{ data: request('u1') }] });
    expect(await getRequestDetail(projectId, 'r1', viewer('customer'), 'u2')).toBeNull();
  });

  it('편집자는 작성자 조건 없이 조회한다', async () => {
    const fake = useFake({
      requests: [{ data: request('u1') }],
      request_corrections: [{ data: [] }],
      request_replies: [{ data: [] }],
      profiles: [{ data: [] }],
    });
    const detail = await getRequestDetail(projectId, 'r1', viewer('editor'), 'pm1');
    expect(detail?.id).toBe('r1');
    expect(fake.opsOf('requests').some((o) => o.args[0] === 'author_id')).toBe(false);
  });

  it('예외: 없는 요청이면 null', async () => {
    useFake({ requests: [{ data: null }] });
    expect(await getRequestDetail(projectId, 'nope', viewer('editor'), 'pm1')).toBeNull();
  });
});

describe('countItemMemos (CU-04 도안 카드 메모 수)', () => {
  it('정상: 항목별로 센다 · 고객은 본인 메모만 (author_id 조건)', async () => {
    const fake = useFake({
      requests: [{ data: [{ target_id: 'd1' }, { target_id: 'd1' }, { target_id: 'd2' }] }],
    });
    expect(await countItemMemos(projectId, viewer('customer'), 'u1', 'designs')).toEqual({
      d1: 2,
      d2: 1,
    });
    const ops = fake.opsOf('requests');
    expect(ops).toContainEqual({ op: 'eq', args: ['target_type', 'designs'] });
    expect(ops).toContainEqual({ op: 'is', args: ['archived_at', null] });
    expect(ops).toContainEqual({ op: 'eq', args: ['author_id', 'u1'] });
  });

  it('편집자는 작성자 조건 없이 센다', async () => {
    const fake = useFake({ requests: [{ data: [] }] });
    expect(await countItemMemos(projectId, viewer('editor'), 'pm1', 'designs')).toEqual({});
    expect(fake.opsOf('requests').some((o) => o.args[0] === 'author_id')).toBe(false);
  });

  it('시공팀은 조회하지 않고 빈 결과 (POL-005)', async () => {
    const fake = useFake({});
    expect(
      await countItemMemos(projectId, { ...viewer('editor'), as: 'field' }, 'f1', 'designs'),
    ).toEqual({});
    expect(fake.calls).toHaveLength(0);
  });

  it('예외: 조회 실패면 throw', async () => {
    useFake({ requests: [{ error: { code: '42501' } }] });
    await expect(countItemMemos(projectId, viewer('editor'), 'pm1', 'designs')).rejects.toThrow(
      'requests.item_memo_counts:42501',
    );
  });
});

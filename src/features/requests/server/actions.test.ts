import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFake, NotFoundSignal } from '@/features/requests/testing';

vi.mock('@/features/core', () => ({
  requireProjectAccess: vi.fn(),
  getAccessContext: vi.fn(),
}));
vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/shared/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  newRef: () => 'ref1234567',
}));

import { getAccessContext, requireProjectAccess } from '@/features/core';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  addRequestCorrection,
  addRequestReply,
  changeRequestStatus,
  createRequest,
  setRequestArchived,
} from './actions';

const projectId = '7a9b8c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const id = '3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f';
const customer = {
  projectId,
  companyId: 'c1',
  companySlug: 'studio',
  as: 'customer' as const,
  canConfirm: false,
};

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

describe('createRequest (REQ-201 · C-T01)', () => {
  const input = { id, projectId, title: '욕실 타일 색', body: '밝은 색으로 바꾸고 싶어요' };

  it('고객이 작성하면 클라이언트 id 로 insert 하고 ok 를 돌려준다', async () => {
    const fake = useFake({ requests: [{ error: null }] });
    const res = await createRequest(input);
    expect(res).toEqual({ ok: true, data: { id } });
    expect(requireProjectAccess).toHaveBeenCalledWith(projectId, ['customer']);
    expect(fake.argOf('requests', 'insert')?.[0]).toMatchObject({
      id,
      project_id: projectId,
      title: '욕실 타일 색',
    });
    expect(revalidatePath).toHaveBeenCalled();
  });

  it('재시도로 같은 id 가 오면(23505) 기존 행을 성공으로 돌려준다 (POL-038)', async () => {
    useFake({
      requests: [{ error: { code: '23505', message: 'duplicate key' } }, { data: { id } }],
    });
    const res = await createRequest(input);
    expect(res).toEqual({ ok: true, data: { id } });
  });

  it('입력이 잘못되면 VALIDATION_FAILED 와 필드 오류 키를 돌려준다', async () => {
    useFake({});
    const res = await createRequest({ ...input, body: '' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('VALIDATION_FAILED');
      expect(res.error.fieldErrors?.body).toContain('field.required');
    }
    expect(requireProjectAccess).not.toHaveBeenCalled();
  });

  it('RLS 가 막으면(42501) FORBIDDEN 과 문의 코드를 돌려준다', async () => {
    useFake({
      requests: [{ error: { code: '42501', message: 'new row violates row-level security' } }],
    });
    const res = await createRequest(input);
    expect(res).toEqual({ ok: false, error: { code: 'FORBIDDEN', ref: 'ref1234567' } });
  });

  it('고객이 아닌 계정은 접근 검사에서 존재를 숨긴다 (notFound)', async () => {
    vi.mocked(requireProjectAccess).mockRejectedValue(new NotFoundSignal());
    useFake({});
    await expect(createRequest(input)).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

const editor = { ...customer, as: 'editor' as const };
const requestId = '9c8b7a6d-5e4f-4321-8abc-def012345678';
const entryId = '1a2b3c4d-5e6f-4789-8abc-0123456789ab';

describe('addRequestCorrection (REQ-203)', () => {
  const input = { id: entryId, projectId, requestId, body: '사이즈도 바꿔 주세요' };

  it('작성 고객은 정정을 추가한다 (원문 테이블은 건드리지 않음)', async () => {
    const fake = useFake({
      requests: [{ data: { id: requestId, archived_at: null } }],
      request_corrections: [{ error: null }],
    });
    const res = await addRequestCorrection(input);
    expect(res).toEqual({ ok: true, data: { id: entryId } });
    expect(requireProjectAccess).toHaveBeenCalledWith(projectId, ['customer']);
    expect(fake.opsOf('requests').some((o) => o.op === 'update')).toBe(false);
    expect(fake.argOf('request_corrections', 'insert')?.[0]).toMatchObject({
      id: entryId,
      request_id: requestId,
    });
  });

  it('다른 프로젝트의 요청 id 면 NOT_FOUND (바꿔치기 차단)', async () => {
    useFake({ requests: [{ data: null }] });
    const res = await addRequestCorrection(input);
    expect(res).toEqual({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('재시도(23505)는 기존 정정을 성공으로 돌려준다', async () => {
    useFake({
      requests: [{ data: { id: requestId, archived_at: null } }],
      request_corrections: [{ error: { code: '23505' } }, { data: { id: entryId } }],
    });
    expect(await addRequestCorrection(input)).toEqual({ ok: true, data: { id: entryId } });
  });

  it('보관된 요청에는 정정할 수 없다', async () => {
    useFake({ requests: [{ data: { id: requestId, archived_at: '2026-10-07T00:00:00Z' } }] });
    expect(await addRequestCorrection(input)).toEqual({ ok: false, error: { code: 'CONFLICT' } });
  });
});

describe('addRequestReply (REQ-204)', () => {
  const input = { id: entryId, projectId, requestId, body: '내일 확인드릴게요' };

  it('편집자는 답변을 추가한다', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(editor);
    useFake({
      requests: [{ data: { id: requestId, archived_at: null } }],
      request_replies: [{ error: null }],
    });
    expect(await addRequestReply(input)).toEqual({ ok: true, data: { id: entryId } });
    expect(requireProjectAccess).toHaveBeenCalledWith(projectId, ['editor']);
  });

  it('보관된 요청에는 답변할 수 없다 — 서버가 CONFLICT (C-04), insert 하지 않음', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(editor);
    const fake = useFake({
      requests: [{ data: { id: requestId, archived_at: '2026-10-07T00:00:00Z' } }],
    });
    expect(await addRequestReply(input)).toEqual({ ok: false, error: { code: 'CONFLICT' } });
    expect(fake.calls.some((c) => c.table === 'request_replies')).toBe(false);
  });

  it('다른 프로젝트·없는 요청 id 면 NOT_FOUND', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(editor);
    useFake({ requests: [{ data: null }] });
    expect(await addRequestReply(input)).toEqual({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('고객은 답변할 수 없다 (접근 검사 notFound)', async () => {
    vi.mocked(requireProjectAccess).mockRejectedValue(new NotFoundSignal());
    useFake({});
    await expect(addRequestReply(input)).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

describe('changeRequestStatus (REQ-205)', () => {
  const base = { projectId, requestId, baseVersion: 3 };

  it('허용 전환은 version·이전 상태 조건으로 갱신한다', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(editor);
    const fake = useFake({ requests: [{ data: { version: 4, status: 'in_progress' } }] });
    const res = await changeRequestStatus({ ...base, from: 'open', to: 'in_progress' });
    expect(res).toEqual({ ok: true, data: { version: 4, status: 'in_progress' } });
    const eqs = fake.opsOf('requests').filter((o) => o.op === 'eq');
    expect(eqs).toContainEqual({ op: 'eq', args: ['version', 3] });
    expect(eqs).toContainEqual({ op: 'eq', args: ['status', 'open'] });
    // C-04: 보관되지 않은 행만 갱신
    expect(fake.opsOf('requests')).toContainEqual({ op: 'is', args: ['archived_at', null] });
  });

  it('다른 사람이 먼저 바꿨으면(0행) VERSION_CONFLICT', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(editor);
    useFake({ requests: [{ data: null }, { data: { id: requestId, archived_at: null } }] });
    const res = await changeRequestStatus({ ...base, from: 'open', to: 'resolved' });
    expect(res).toEqual({ ok: false, error: { code: 'VERSION_CONFLICT' } });
  });

  it('보관된 요청은 상태를 바꿀 수 없다 (0행 → 재조회로 CONFLICT, C-04)', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(editor);
    useFake({
      requests: [{ data: null }, { data: { id: requestId, archived_at: '2026-10-07T00:00:00Z' } }],
    });
    const res = await changeRequestStatus({ ...base, from: 'open', to: 'resolved' });
    expect(res).toEqual({ ok: false, error: { code: 'CONFLICT' } });
  });

  it('없거나 볼 수 없는 요청은 NOT_FOUND (존재 숨김)', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(editor);
    useFake({ requests: [{ data: null }, { data: null }] });
    const res = await changeRequestStatus({ ...base, from: 'open', to: 'resolved' });
    expect(res).toEqual({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('DB 상태 가드(23514)는 VALIDATION_FAILED + 문의 코드', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(editor);
    useFake({ requests: [{ error: { code: '23514', message: 'invalid_status_transition' } }] });
    const res = await changeRequestStatus({ ...base, from: 'open', to: 'resolved' });
    expect(res).toEqual({ ok: false, error: { code: 'VALIDATION_FAILED', ref: 'ref1234567' } });
  });

  it('고객은 상태를 바꿀 수 없다 (접근 검사 notFound)', async () => {
    vi.mocked(requireProjectAccess).mockRejectedValue(new NotFoundSignal());
    useFake({});
    await expect(changeRequestStatus({ ...base, from: 'open', to: 'resolved' })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });

  it('허용되지 않는 전환은 DB 에 가지 않고 VALIDATION_FAILED', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(editor);
    useFake({});
    const res = await changeRequestStatus({ ...base, from: 'resolved', to: 'open' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('setRequestArchived (POL-020)', () => {
  it('보관은 archived_at 을 채우고 삭제하지 않는다', async () => {
    vi.mocked(requireProjectAccess).mockResolvedValue(editor);
    const fake = useFake({ requests: [{ data: { version: 2 } }] });
    const res = await setRequestArchived({ projectId, requestId, baseVersion: 1, archived: true });
    expect(res).toEqual({ ok: true, data: { version: 2 } });
    const update = fake.argOf('requests', 'update')?.[0] as { archived_at: string | null };
    expect(update.archived_at).not.toBeNull();
  });
});

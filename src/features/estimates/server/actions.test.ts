// @vitest-environment node
// B-04 23505 재시도 분기의 소속 확인, B-05 견적 보관·복원, B-06·B-08 공개 전환
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFake, NotFoundSignal } from '@/features/files/testing/supabase-fake';

vi.mock('@/features/core', () => ({ requireProjectAccess: vi.fn(), getAccessContext: vi.fn() }));
vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/shared/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  newRef: () => 'ref1234567',
}));

import { revalidatePath } from 'next/cache';
import { getAccessContext, requireProjectAccess } from '@/features/core';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import {
  addEstimateVersion,
  createEstimate,
  setEstimateArchived,
  setEstimateVersionPublic,
} from './actions';

const projectId = '00000000-0000-4000-8000-0000000000b1';
const otherProject = '00000000-0000-4000-8000-0000000000b2';
const id = '00000000-0000-4000-8000-0000000000e1';
const versionId = '00000000-0000-4000-8000-0000000000e2';
const fileId = '00000000-0000-4000-8000-0000000000f1';
const access = {
  projectId,
  companyId: 'c1',
  companySlug: 'studio',
  as: 'editor' as const,
  canConfirm: false,
};
const create = {
  projectId,
  id,
  versionId,
  title: '1차 견적',
  versionLabel: 'v1',
  changeNote: '최초',
  fileId,
  isPublic: false,
};
const dup = { error: { code: '23505', message: 'duplicate key' } };

function useFake(script: Parameters<typeof createSupabaseFake>[0]) {
  const fake = createSupabaseFake(script);
  vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
  return fake;
}

const ctxWith = (role: 'owner' | 'manager' | 'pm') => ({
  userId: 'u1',
  displayName: 'U1',
  locale: 'ko' as const,
  memberships: [{ companyId: 'c1', slug: 'studio', name: '스튜디오', role }],
  participations: [],
  areas: ['app' as const],
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireProjectAccess).mockResolvedValue(access);
  // D-37: 견적서 쓰기는 업체관리자 — 기본은 소유자로 확인
  vi.mocked(getAccessContext).mockResolvedValue(ctxWith('owner'));
});

describe('createEstimate (D-05 원자적 RPC)', () => {
  it('정상: create_estimate RPC 한 번으로 견적 + 1번 버전', async () => {
    const fake = useFake({ 'rpc:create_estimate': [{ data: 1 }] });
    expect(await createEstimate(create)).toEqual({ ok: true, data: { id, versionNo: 1 } });
    expect(fake.callsOf('estimates')).toHaveLength(0);
    expect(fake.callsOf('estimate_versions')).toHaveLength(0);
    expect(fake.argOf('rpc:create_estimate', 'rpc')?.[0]).toMatchObject({
      p_id: id,
      p_version_id: versionId,
      p_project: projectId,
      p_title: '1차 견적',
      p_file: fileId,
      p_is_public: false,
    });
  });

  it('같은 폼 재시도(23505)는 이 견적·프로젝트의 버전이면 성공', async () => {
    useFake({
      'rpc:create_estimate': [dup],
      estimate_versions: [{ data: { version_no: 1, estimate_id: id, project_id: projectId } }],
    });
    expect(await createEstimate(create)).toEqual({ ok: true, data: { id, versionNo: 1 } });
  });

  it('23505 인데 다른 견적·프로젝트이거나 보이지 않으면 CONFLICT', async () => {
    useFake({
      'rpc:create_estimate': [dup],
      estimate_versions: [
        { data: { version_no: 4, estimate_id: 'another', project_id: projectId } },
      ],
    });
    expect(await createEstimate(create)).toMatchObject({ error: { code: 'CONFLICT' } });
    useFake({
      'rpc:create_estimate': [dup],
      estimate_versions: [{ data: { version_no: 1, estimate_id: id, project_id: otherProject } }],
    });
    expect(await createEstimate(create)).toMatchObject({ error: { code: 'CONFLICT' } });
    useFake({ 'rpc:create_estimate': [dup], estimate_versions: [{ data: null }] });
    expect(await createEstimate(create)).toMatchObject({ error: { code: 'CONFLICT' } });
  });

  it('DB 오류(파일 오류 등)는 실패로 끝나고 재조회하지 않는다', async () => {
    const fake = useFake({
      'rpc:create_estimate': [{ error: { code: 'P0001', message: 'file_not_ready' } }],
    });
    const res = await createEstimate(create);
    expect(res.ok).toBe(false);
    expect(fake.callsOf('estimate_versions')).toHaveLength(0);
  });

  it('비로그인은 UNAUTHENTICATED, 편집자가 아니면 404', async () => {
    const anon = createSupabaseFake({}, { user: null });
    vi.mocked(createServerSupabase).mockResolvedValue(anon.client as never);
    expect(await createEstimate(create)).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
    vi.mocked(requireProjectAccess).mockRejectedValue(new NotFoundSignal());
    await expect(createEstimate(create)).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

describe('addEstimateVersion', () => {
  it('보관된 견적에는 새 버전을 올리지 않는다', async () => {
    const fake = useFake({
      estimates: [{ data: { id, archived_at: '2026-10-01T00:00:00Z' } }],
    });
    const res = await addEstimateVersion({
      projectId,
      estimateId: id,
      versionId,
      versionLabel: 'v2',
      changeNote: '수정',
      fileId,
      isPublic: false,
    });
    expect(res).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(fake.callsOf('estimate_versions')).toHaveLength(0);
  });
});

describe('setEstimateArchived (B-05)', () => {
  const versioned = { projectId, id, baseVersion: 1 };
  it('보관: archived_at 설정 + app·portal 목록/상세 경로 갱신', async () => {
    const fake = useFake({ estimates: [{ data: { version: 2 } }] });
    expect(await setEstimateArchived({ ...versioned, archived: true })).toEqual({
      ok: true,
      data: { version: 2 },
    });
    const patch = fake.argOf('estimates', 'update')?.[0] as { archived_at: string | null };
    expect(patch.archived_at).toEqual(expect.any(String));
    expect(fake.hasOp('estimates', 'eq', ['version', 1])).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith(`/portal/projects/${projectId}/estimates`);
    expect(revalidatePath).toHaveBeenCalledWith(
      expect.stringContaining(`/app/studio/projects/${projectId}/estimates`),
    );
  });
  it('복원: archived_at=null', async () => {
    const fake = useFake({ estimates: [{ data: { version: 3 } }] });
    expect(await setEstimateArchived({ ...versioned, archived: false })).toMatchObject({
      ok: true,
    });
    expect(fake.argOf('estimates', 'update')?.[0]).toEqual({ archived_at: null });
  });
  it('0행: 버전 다름 → VERSION_CONFLICT, 없음 → NOT_FOUND', async () => {
    useFake({ estimates: [{ data: null }, { data: { version: 4, archived_at: null } }] });
    expect(await setEstimateArchived({ ...versioned, archived: true })).toMatchObject({
      error: { code: 'VERSION_CONFLICT' },
    });
    useFake({ estimates: [{ data: null }, { data: null }] });
    expect(await setEstimateArchived({ ...versioned, archived: true })).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it('입력 오류·권한', async () => {
    useFake({});
    expect(
      await setEstimateArchived({ ...versioned, baseVersion: 0, archived: true }),
    ).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
    vi.mocked(requireProjectAccess).mockRejectedValue(new NotFoundSignal());
    await expect(setEstimateArchived({ ...versioned, archived: true })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });
});

describe('setEstimateVersionPublic (B-06·B-08)', () => {
  const input = { projectId, estimateId: id, id: versionId, baseVersion: 1, isPublic: true };
  it('보관된 견적의 버전은 CONFLICT', async () => {
    const fake = useFake({ estimates: [{ data: { archived_at: '2026-10-01T00:00:00Z' } }] });
    expect(await setEstimateVersionPublic(input)).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(fake.callsOf('estimate_versions')).toHaveLength(0);
  });
  it('0행 원인 구분: 버전 다름 → VERSION_CONFLICT', async () => {
    useFake({
      estimates: [{ data: { archived_at: null } }],
      estimate_versions: [{ data: null }, { data: { version: 2, archived_at: null } }],
    });
    expect(await setEstimateVersionPublic(input)).toMatchObject({
      error: { code: 'VERSION_CONFLICT' },
    });
  });
  it('정상', async () => {
    useFake({
      estimates: [{ data: { archived_at: null } }],
      estimate_versions: [{ data: { version: 2 } }],
    });
    expect(await setEstimateVersionPublic(input)).toEqual({ ok: true, data: { version: 2 } });
  });
});

describe('D-37 견적서는 업체관리자만', () => {
  it('담당자(pm)는 편집자여도 등록 · 새 버전 · 공개 · 보관 모두 FORBIDDEN (DB 호출 없음)', async () => {
    vi.mocked(getAccessContext).mockResolvedValue(ctxWith('pm'));
    const fake = useFake({});
    for (const res of [
      await createEstimate(create),
      await addEstimateVersion({
        projectId,
        estimateId: id,
        versionId,
        versionLabel: 'v2',
        changeNote: '수정',
        fileId,
        isPublic: false,
      }),
      await setEstimateVersionPublic({
        projectId,
        estimateId: id,
        id: versionId,
        baseVersion: 1,
        isPublic: true,
      }),
      await setEstimateArchived({ projectId, id, baseVersion: 1, archived: true }),
    ]) {
      expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    }
    expect(fake.callsOf('rpc:create_estimate')).toHaveLength(0);
    expect(fake.callsOf('estimates')).toHaveLength(0);
    expect(fake.callsOf('estimate_versions')).toHaveLength(0);
  });

  it('관리자(manager)는 등록할 수 있다', async () => {
    vi.mocked(getAccessContext).mockResolvedValue(ctxWith('manager'));
    const fake = useFake({ 'rpc:create_estimate': [{ data: 1 }] });
    expect(await createEstimate(create)).toMatchObject({ ok: true });
    expect(fake.callsOf('rpc:create_estimate')).toHaveLength(1);
  });
});

// @vitest-environment node
// B-06 보관 대상 수정 거부, B-08 0행 update 원인 구분(NOT_FOUND / VERSION_CONFLICT / CONFLICT), B-13 소속 확인
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFake, NotFoundSignal } from '@/features/files/testing/supabase-fake';

vi.mock('@/features/core', () => ({ requireProjectAccess: vi.fn() }));
vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/shared/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  newRef: () => 'ref1234567',
}));

import { revalidatePath } from 'next/cache';
import { requireProjectAccess } from '@/features/core';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import {
  addDesignPreview,
  addDesignVersion,
  archiveDesignPreview,
  setDesignArchived,
  setDesignPublic,
  updateDesign,
} from './actions';

const projectId = '00000000-0000-4000-8000-0000000000b1';
const id = '00000000-0000-4000-8000-0000000000d1';
const fileId = '00000000-0000-4000-8000-0000000000f1';
const previewId = '00000000-0000-4000-8000-0000000000e1';
const access = {
  projectId,
  companyId: 'c1',
  companySlug: 'studio',
  as: 'editor' as const,
  canConfirm: false,
};

function useFake(script: Parameters<typeof createSupabaseFake>[0]) {
  const fake = createSupabaseFake(script);
  vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
  return fake;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireProjectAccess).mockResolvedValue(access);
});

const update = { projectId, id, baseVersion: 3, title: '평면도', description: '' };

describe('updateDesign (B-06·B-08)', () => {
  it('정상: 보관되지 않은 행만 낙관적 잠금으로 갱신하고 app·portal 경로를 갱신한다', async () => {
    const fake = useFake({ designs: [{ data: { version: 4 } }] });
    expect(await updateDesign(update)).toEqual({ ok: true, data: { version: 4 } });
    expect(fake.hasOp('designs', 'eq', ['version', 3])).toBe(true);
    expect(fake.hasOp('designs', 'is', ['archived_at', null])).toBe(true);
    expect(requireProjectAccess).toHaveBeenCalledWith(projectId, ['editor']);
    expect(revalidatePath).toHaveBeenCalledWith(`/portal/projects/${projectId}/designs/${id}`);
  });

  it('보관된 도안이면 CONFLICT', async () => {
    useFake({
      designs: [{ data: null }, { data: { version: 3, archived_at: '2026-10-01T00:00:00Z' } }],
    });
    expect(await updateDesign(update)).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('버전이 다르면 VERSION_CONFLICT', async () => {
    useFake({ designs: [{ data: null }, { data: { version: 5, archived_at: null } }] });
    expect(await updateDesign(update)).toMatchObject({ error: { code: 'VERSION_CONFLICT' } });
  });

  it('행이 없거나 볼 수 없으면 NOT_FOUND (VERSION_CONFLICT 로 뭉뚱그리지 않음)', async () => {
    useFake({ designs: [{ data: null }, { data: null }] });
    expect(await updateDesign(update)).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('입력 오류는 DB 를 부르지 않고 VALIDATION_FAILED (메시지 키 규약)', async () => {
    const fake = useFake({});
    const res = await updateDesign({ ...update, title: '' });
    expect(res).toMatchObject({
      error: { code: 'VALIDATION_FAILED', fieldErrors: { title: ['required'] } },
    });
    expect(fake.calls).toHaveLength(0);
    expect(requireProjectAccess).not.toHaveBeenCalled();
  });

  it('권한: 편집자가 아니면 requireProjectAccess 가 404 로 끊는다 (DB 호출 없음)', async () => {
    vi.mocked(requireProjectAccess).mockRejectedValue(new NotFoundSignal());
    const fake = useFake({});
    await expect(updateDesign(update)).rejects.toThrow('NEXT_NOT_FOUND');
    expect(fake.calls).toHaveLength(0);
  });
});

describe('setDesignPublic / setDesignArchived', () => {
  const versioned = { projectId, id, baseVersion: 3 };
  it('보관 중 공개 전환은 CONFLICT', async () => {
    const fake = useFake({
      designs: [{ data: null }, { data: { version: 3, archived_at: '2026-10-01T00:00:00Z' } }],
    });
    expect(await setDesignPublic({ ...versioned, isPublic: true })).toMatchObject({
      error: { code: 'CONFLICT' },
    });
    expect(fake.hasOp('designs', 'is', ['archived_at', null])).toBe(true);
  });

  it('복원은 보관된 행에도 적용된다 (archived 필터 없음)', async () => {
    const fake = useFake({ designs: [{ data: { version: 4 } }] });
    expect(await setDesignArchived({ ...versioned, archived: false })).toEqual({
      ok: true,
      data: { version: 4 },
    });
    expect(fake.argOf('designs', 'update')?.[0]).toEqual({ archived_at: null });
    expect(fake.hasOp('designs', 'is', ['archived_at', null])).toBe(false);
  });

  it('보관 0행: 버전 다름 → VERSION_CONFLICT, 없음 → NOT_FOUND', async () => {
    useFake({ designs: [{ data: null }, { data: { version: 9, archived_at: null } }] });
    expect(await setDesignArchived({ ...versioned, archived: true })).toMatchObject({
      error: { code: 'VERSION_CONFLICT' },
    });
    useFake({ designs: [{ data: null }, { data: null }] });
    expect(await setDesignArchived({ ...versioned, archived: true })).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
  });
});

describe('addDesignVersion (B-06)', () => {
  const input = { projectId, designId: id, note: '', fileId };
  it('보관된 도안이면 RPC 를 부르지 않고 CONFLICT', async () => {
    const fake = useFake({
      designs: [{ data: { confirm_state: 'none', archived_at: '2026-10-01T00:00:00Z' } }],
    });
    expect(await addDesignVersion(input)).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(fake.client.rpc).not.toHaveBeenCalled();
  });
  it('B-09: RPC 뒤에 판정 — 이 버전이 직전 리비전 확정을 new_version 으로 무효화했으면 reconfirm=true', async () => {
    const fake = useFake({
      designs: [{ data: { archived_at: null } }],
      'rpc:add_design_version': [{ data: 'v2' }],
      design_versions: [{ data: { version_no: 2 } }],
      confirmations: [{ data: { id: 'c1' } }],
    });
    expect(await addDesignVersion(input)).toEqual({
      ok: true,
      data: { versionId: 'v2', reconfirm: true },
    });
    expect(fake.hasOp('design_versions', 'eq', ['id', 'v2'])).toBe(true);
    expect(fake.hasOp('confirmations', 'eq', ['target_revision', 1])).toBe(true);
    expect(fake.hasOp('confirmations', 'eq', ['invalidated_reason', 'new_version'])).toBe(true);
    // 미리 읽은 confirm_state 로 판정하지 않는다
    expect(fake.argOf('designs', 'select')).toEqual(['archived_at']);
  });
  it('B-09: 무효화된 기록이 없으면(그 사이 재확인 요청·미확정) reconfirm=false', async () => {
    useFake({
      designs: [{ data: { archived_at: null } }],
      'rpc:add_design_version': [{ data: 'v3' }],
      design_versions: [{ data: { version_no: 3 } }],
      confirmations: [{ data: null }],
    });
    expect(await addDesignVersion(input)).toEqual({
      ok: true,
      data: { versionId: 'v3', reconfirm: false },
    });
  });
  it('B-09: 재조회 실패는 저장 성공을 뒤집지 않는다 (reconfirm=false + 로그)', async () => {
    useFake({
      designs: [{ data: { archived_at: null } }],
      'rpc:add_design_version': [{ data: 'v3' }],
      design_versions: [{ error: { code: '500', message: 'x' } }],
    });
    expect(await addDesignVersion(input)).toEqual({
      ok: true,
      data: { versionId: 'v3', reconfirm: false },
    });
  });
  it('B-10: 사전 조회 오류는 삼키지 않고 오류로 돌려준다', async () => {
    const fake = useFake({ designs: [{ error: { code: '500', message: 'boom' } }] });
    expect(await addDesignVersion(input)).toMatchObject({
      ok: false,
      error: { ref: 'ref1234567' },
    });
    expect(fake.client.rpc).not.toHaveBeenCalled();
  });
  it('다른 프로젝트의 도안이면 NOT_FOUND', async () => {
    useFake({ designs: [{ data: null }] });
    expect(await addDesignVersion(input)).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});

describe('addDesignPreview / archiveDesignPreview (B-06·B-13)', () => {
  const input = {
    projectId,
    designId: id,
    id: previewId,
    fileId,
    label: '거실',
    designVersionId: null,
    pdfPage: null,
  };
  it('보관된 도안에는 비교 이미지를 붙이지 않는다', async () => {
    const fake = useFake({ designs: [{ data: { id, archived_at: '2026-10-01T00:00:00Z' } }] });
    expect(await addDesignPreview(input)).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(fake.callsOf('design_previews')).toHaveLength(0);
  });
  it('이 프로젝트의 도안이 아니면 NOT_FOUND', async () => {
    const fake = useFake({ designs: [{ data: null }] });
    expect(await addDesignPreview(input)).toMatchObject({ error: { code: 'NOT_FOUND' } });
    expect(fake.hasOp('designs', 'eq', ['project_id', projectId])).toBe(true);
  });
  it('같은 id 재시도(23505)는 같은 도안의 행이 있을 때만 성공', async () => {
    useFake({
      designs: [{ data: { id, archived_at: null } }],
      design_previews: [{ error: { code: '23505', message: 'dup' } }, { data: { id: previewId } }],
    });
    expect(await addDesignPreview(input)).toEqual({ ok: true, data: { id: previewId } });
    useFake({
      designs: [{ data: { id, archived_at: null } }],
      design_previews: [{ error: { code: '23505', message: 'dup' } }, { data: null }],
    });
    expect(await addDesignPreview(input)).toMatchObject({ ok: false });
  });
  it('보관은 프로젝트·도안 소속을 함께 건다', async () => {
    const fake = useFake({ design_previews: [{ data: { id: previewId } }] });
    expect(await archiveDesignPreview({ projectId, designId: id, id: previewId })).toEqual({
      ok: true,
      data: undefined,
    });
    expect(fake.hasOp('design_previews', 'eq', ['project_id', projectId])).toBe(true);
  });
});

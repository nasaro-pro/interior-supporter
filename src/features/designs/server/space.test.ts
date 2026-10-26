// @vitest-environment node
// D-26 공간 지정 · D-27 대표 도안 · D-28 순서 이동 (서버 액션) + 목록 공간 묶음
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFake, NotFoundSignal } from '@/features/files/testing/supabase-fake';

vi.mock('@/features/core', () => ({ requireProjectAccess: vi.fn() }));
vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/shared/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  newRef: () => 'ref1234567',
}));

import { requireProjectAccess } from '@/features/core';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { createDesign, moveDesign, moveDesignSpace, setMainDesign, updateDesign } from './actions';
import { moveSpace, moveWithinSpace, parseSpaceParam, pickHero } from '../lib/order';
import { groupBySpace } from '../components/DesignList';
import type { DesignListItem } from '../types';

const projectId = '00000000-0000-4000-8000-0000000000b1';
const id = '00000000-0000-4000-8000-0000000000d1';
const d2 = '00000000-0000-4000-8000-0000000000d2';
const d3 = '00000000-0000-4000-8000-0000000000d3';
const fileId = '00000000-0000-4000-8000-0000000000f1';
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

describe('D-26 공간', () => {
  const create = {
    projectId,
    title: '거실',
    description: '',
    note: '',
    isPublic: false,
    fileId,
  };

  it('생성 때 공간을 고르면 만든 도안에 공간을 지정한다', async () => {
    const fake = useFake({ 'rpc:create_design': [{ data: id }], designs: [{ error: null }] });
    expect(await createDesign({ ...create, space: 'living' })).toEqual({
      ok: true,
      data: { id },
    });
    expect(fake.argOf('designs', 'update')?.[0]).toEqual({ space: 'living' });
    expect(fake.hasOp('designs', 'eq', ['project_id', projectId])).toBe(true);
  });

  it('공간을 고르지 않으면(전체) 추가 update 없음', async () => {
    const fake = useFake({ 'rpc:create_design': [{ data: id }] });
    expect(await createDesign({ ...create, space: null })).toEqual({ ok: true, data: { id } });
    expect(fake.callsOf('designs')).toHaveLength(0);
  });

  it('없는 공간 값은 입력 오류', async () => {
    useFake({});
    expect(await createDesign({ ...create, space: 'garage' })).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED' },
    });
  });

  it('수정: space 를 보내면 바꾸고, 안 보내면 건드리지 않는다', async () => {
    const base = { projectId, id, baseVersion: 3, title: '거실', description: '' };
    let fake = useFake({ designs: [{ data: { version: 4 } }] });
    await updateDesign({ ...base, space: 'kitchen' });
    expect(fake.argOf('designs', 'update')?.[0]).toMatchObject({ space: 'kitchen' });
    fake = useFake({ designs: [{ data: { version: 4 } }] });
    await updateDesign(base);
    expect(fake.argOf('designs', 'update')?.[0]).not.toHaveProperty('space');
  });
});

describe('D-27 setMainDesign', () => {
  it('정상: set_main_design RPC', async () => {
    const fake = useFake({
      designs: [{ data: { version: 1, archived_at: null } }],
      'rpc:set_main_design': [{ data: null }],
    });
    expect(await setMainDesign({ projectId, id })).toEqual({ ok: true, data: null });
    expect(fake.argOf('rpc:set_main_design', 'rpc')?.[0]).toEqual({ p_design: id });
  });

  it('보관된 도안은 CONFLICT, 없는 도안은 NOT_FOUND (RPC 를 부르지 않음)', async () => {
    let fake = useFake({ designs: [{ data: { version: 1, archived_at: '2026-10-01' } }] });
    expect(await setMainDesign({ projectId, id })).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(fake.callsOf('rpc:set_main_design')).toHaveLength(0);
    fake = useFake({ designs: [{ data: null }] });
    expect(await setMainDesign({ projectId, id })).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('권한 거부: 편집자가 아니면 404', async () => {
    vi.mocked(requireProjectAccess).mockRejectedValue(new NotFoundSignal());
    await expect(setMainDesign({ projectId, id })).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

describe('D-28 moveDesign (같은 공간 안에서만)', () => {
  const row = (i: string, space: string | null, is_main = false) => ({ id: i, space, is_main });

  it('위로: 같은 공간의 바로 앞 도안과 자리를 바꿔 전체 순서를 저장', async () => {
    const fake = useFake({
      designs: [{ data: [row(d2, 'living'), row(d3, 'kitchen'), row(id, 'living')] }],
      'rpc:reorder_designs': [{ data: null }],
    });
    expect(await moveDesign({ projectId, id, direction: 'up' })).toEqual({ ok: true, data: null });
    // 묶음: living[d2,id] kitchen[d3] → living[id,d2] kitchen[d3]
    expect(fake.argOf('rpc:reorder_designs', 'rpc')?.[0]).toEqual({
      p_project: projectId,
      p_ids: [id, d2, d3],
    });
    expect(fake.hasOp('designs', 'is', ['archived_at', null])).toBe(true);
  });

  it('공간의 맨 아래면 다른 공간으로 넘어가지 않고 아무것도 바꾸지 않음', async () => {
    const fake = useFake({
      designs: [{ data: [row(d2, 'living'), row(id, 'living'), row(d3, 'kitchen')] }],
    });
    expect(await moveDesign({ projectId, id, direction: 'down' })).toEqual({
      ok: true,
      data: null,
    });
    expect(fake.callsOf('rpc:reorder_designs')).toHaveLength(0);
  });

  it('목록에 없는 도안(보관·다른 프로젝트)은 NOT_FOUND', async () => {
    useFake({ designs: [{ data: [row(d2, null)] }] });
    expect(await moveDesign({ projectId, id, direction: 'up' })).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
  });
});

describe('D-28 moveDesignSpace (공간 순서)', () => {
  const row = (i: string, space: string | null, is_main = false) => ({ id: i, space, is_main });

  it('아래로: 공간 묶음을 통째로 다음 공간 뒤로 옮긴다', async () => {
    const fake = useFake({
      designs: [{ data: [row(id, 'living'), row(d2, 'kitchen'), row(d3, 'living')] }],
      'rpc:reorder_designs': [{ data: null }],
    });
    expect(await moveDesignSpace({ projectId, space: 'living', direction: 'down' })).toEqual({
      ok: true,
      data: null,
    });
    expect(fake.argOf('rpc:reorder_designs', 'rpc')?.[0]).toEqual({
      p_project: projectId,
      p_ids: [d2, id, d3],
    });
  });

  it('전체(null) 공간도 옮길 수 있고, 맨 위에서 위로는 변화 없음', async () => {
    let fake = useFake({
      designs: [{ data: [row(id, 'living'), row(d2, null)] }],
      'rpc:reorder_designs': [{ data: null }],
    });
    await moveDesignSpace({ projectId, space: null, direction: 'up' });
    expect(fake.argOf('rpc:reorder_designs', 'rpc')?.[0]).toMatchObject({ p_ids: [d2, id] });
    fake = useFake({ designs: [{ data: [row(id, 'living'), row(d2, null)] }] });
    expect(await moveDesignSpace({ projectId, space: 'living', direction: 'up' })).toEqual({
      ok: true,
      data: null,
    });
    expect(fake.callsOf('rpc:reorder_designs')).toHaveLength(0);
  });

  it('없는 공간은 NOT_FOUND, 잘못된 공간 값은 입력 오류', async () => {
    useFake({ designs: [{ data: [row(id, 'living')] }] });
    expect(await moveDesignSpace({ projectId, space: 'kitchen', direction: 'up' })).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
    expect(await moveDesignSpace({ projectId, space: 'garage', direction: 'up' })).toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });
  });

  it('권한 거부: 편집자가 아니면 404', async () => {
    vi.mocked(requireProjectAccess).mockRejectedValue(new NotFoundSignal());
    await expect(moveDesignSpace({ projectId, space: null, direction: 'up' })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });
});

describe('lib/order 순수 함수', () => {
  const o = (i: string, space: 'living' | 'kitchen' | null, isMain = false) => ({
    id: i,
    space,
    isMain,
  });
  it('대표 도안은 자기 공간 묶음 맨 앞, 공간 순서는 대표와 무관하게 정한 순서', () => {
    const g = groupBySpace([o('a', 'kitchen'), o('b', 'living'), o('c', 'living', true)]);
    expect(g.map((x) => x.space)).toEqual(['kitchen', 'living']);
    expect(g[1]?.items.map((x) => x.id)).toEqual(['c', 'b']);
    expect(moveSpace(g, 'living', 'up')).toEqual(['c', 'b', 'a']);
    expect(moveWithinSpace(g, 'b', 'up')).toEqual(['a', 'b', 'c']);
    expect(moveWithinSpace(g, 'zz', 'up')).toBe('missing');
  });
});

describe('D-26·D-28 groupBySpace', () => {
  const item = (i: string, space: DesignListItem['space'], isMain = false): DesignListItem => ({
    id: i,
    title: i,
    currentVersion: 1,
    isPublic: true,
    confirmState: 'none',
    updatedAt: '2026-10-24T00:00:00Z',
    archivedAt: null,
    previewFileId: null,
    space,
    isMain,
    sortOrder: 0,
  });

  it('목록 순서를 지키면서 공간별로 묶고, 공간 순서는 첫 등장 순서', () => {
    const groups = groupBySpace([
      item('a', null, true),
      item('b', 'kitchen'),
      item('c', 'living'),
      item('d', 'kitchen'),
    ]);
    expect(groups.map((g) => g.space)).toEqual([null, 'kitchen', 'living']);
    expect(groups[1]?.items.map((x) => x.id)).toEqual(['b', 'd']);
  });
});

describe('CU-03 · CU-04 고객 도안 화면 규칙', () => {
  const item = (i: string, o: Partial<DesignListItem> = {}): DesignListItem => ({
    id: i,
    title: i,
    currentVersion: 1,
    isPublic: true,
    confirmState: 'none',
    updatedAt: '2026-10-24T00:00:00Z',
    archivedAt: null,
    previewFileId: `f-${i}`,
    space: null,
    isMain: false,
    sortOrder: 0,
    ...o,
  });

  it('대표 도안(이미지 있음)이 먼저', () => {
    expect(pickHero([item('a'), item('b', { isMain: true })])?.id).toBe('b');
  });
  it('대표가 없거나 이미지가 없으면 이미지가 있는 최근 도안, 이미지가 하나도 없으면 null', () => {
    expect(
      pickHero([
        item('a', { updatedAt: '2026-10-20T00:00:00Z' }),
        item('b', { updatedAt: '2026-10-23T00:00:00Z' }),
        item('m', { isMain: true, previewFileId: null }),
      ])?.id,
    ).toBe('b');
    expect(pickHero([item('a', { previewFileId: null })])).toBeNull();
  });
  it('?space= 해석: 없음 → 대표, all → 전체, whole → 집 전체, 공간 이름 → 그 공간, 모르는 값 → 대표', () => {
    const S = ['living', 'kitchen'];
    expect(parseSpaceParam(undefined, S)).toEqual({ mode: 'hero' });
    expect(parseSpaceParam('all', S)).toEqual({ mode: 'all' });
    expect(parseSpaceParam('whole', S)).toEqual({ mode: 'space', space: null });
    expect(parseSpaceParam('kitchen', S)).toEqual({ mode: 'space', space: 'kitchen' });
    expect(parseSpaceParam('garage', S)).toEqual({ mode: 'hero' });
  });
});

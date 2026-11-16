import { describe, expect, it } from 'vitest';
import {
  canToggleFeatured,
  chooseCover,
  featuredState,
  moveWork,
  setRole,
  type ManageWork,
  type PickedImage,
} from './manage';

const w = (id: string, o: Partial<ManageWork> = {}): ManageWork => ({
  id,
  version: 1,
  projectId: null,
  editable: true,
  title: id,
  areaLabel: '',
  sizePyeong: null,
  durationWeeks: null,
  completedOn: null,
  status: 'published',
  hasConsent: true,
  isFeatured: false,
  coverThumbPath: 'x.webp',
  photoCount: 3,
  sortOrder: 0,
  ...o,
});

describe('featured', () => {
  const works = [
    w('a', { isFeatured: true }),
    w('b', { isFeatured: true }),
    w('c'),
    w('d', { coverThumbPath: null }),
  ];
  it('세기·가득 참·초과', () => {
    expect(featuredState(works, 3)).toMatchObject({ count: 2, full: false, over: false });
    expect(featuredState(works, 2)).toMatchObject({ full: true, over: false });
    expect(featuredState(works, 1)).toMatchObject({ over: true });
  });
  it('해제는 언제나, 지정은 자리+대표사진', () => {
    expect(canToggleFeatured(works[0]!, works, 1)).toBe(true);
    expect(canToggleFeatured(works[2]!, works, 3)).toBe(true);
    expect(canToggleFeatured(works[2]!, works, 2)).toBe(false);
    expect(canToggleFeatured(works[3]!, works, 6)).toBe(false);
  });
});

describe('moveWork', () => {
  const works = [w('a'), w('b', { version: 4 }), w('c')];
  it('한 칸 옮기고 0..n-1 로 다시 매김', () => {
    expect(moveWork(works, 'b', -1)).toEqual([
      { id: 'b', baseVersion: 4, sortOrder: 0 },
      { id: 'a', baseVersion: 1, sortOrder: 1 },
      { id: 'c', baseVersion: 1, sortOrder: 2 },
    ]);
  });
  it('끝에서 더 못 감 / 없는 id', () => {
    expect(moveWork(works, 'a', -1)).toBeNull();
    expect(moveWork(works, 'c', 1)).toBeNull();
    expect(moveWork(works, 'z', 1)).toBeNull();
  });
});

describe('setRole / chooseCover', () => {
  const p = (id: string, role: PickedImage['role'] = 'gallery'): PickedImage => ({
    sourceFileId: id,
    space: null,
    spaceLabel: '',
    role,
  });
  it('비포·애프터는 한 장씩', () => {
    const r = setRole([p('1', 'after'), p('2'), p('3', 'before')], '2', 'after');
    expect(r.map((x) => x.role)).toEqual(['gallery', 'after', 'before']);
    expect(setRole(r, '1', 'gallery').map((x) => x.role)).toEqual(['gallery', 'after', 'before']);
  });
  it('대표 사진: 애프터 > 일반 > 없음', () => {
    expect(
      chooseCover([
        { imageId: 'g', role: 'gallery' },
        { imageId: 'a', role: 'after' },
      ]),
    ).toBe('a');
    expect(
      chooseCover([
        { imageId: 'b', role: 'before' },
        { imageId: 'g', role: 'gallery' },
      ]),
    ).toBe('g');
    expect(chooseCover([{ imageId: 'b', role: 'before' }])).toBeNull();
  });
});

import { numOrNull, workPatch, type WorkFields } from './manage';
describe('workPatch / numOrNull', () => {
  const base: WorkFields = {
    title: '청담',
    areaLabel: '청담동',
    sizePyeong: 32,
    durationWeeks: 7,
    completedOn: null,
    spaces: ['living', 'kitchen'],
    summary: '',
  };
  it('바뀐 칸만, 공간은 순서 무시', () => {
    expect(workPatch(base, { ...base })).toEqual({});
    expect(workPatch(base, { ...base, spaces: ['kitchen', 'living'] })).toEqual({});
    expect(workPatch(base, { ...base, sizePyeong: 34, spaces: ['living'] })).toEqual({
      sizePyeong: 34,
      spaces: ['living'],
    });
    expect(workPatch(base, { ...base, durationWeeks: null })).toEqual({ durationWeeks: null });
  });
  it('입력칸 숫자', () => {
    expect(numOrNull('')).toBeNull();
    expect(numOrNull(' 32.5 ')).toBe(32.5);
    expect(Number.isNaN(numOrNull('abc'))).toBe(true);
  });
});

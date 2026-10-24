import { describe, expect, it } from 'vitest';
import { groupPhotosByDate } from './group';
import type { PhotoItem } from '../types';

const photo = (id: string, capturedOn: string | null): PhotoItem => ({
  id,
  projectId: 'p',
  fileId: `f-${id}`,
  thumbFileId: null,
  phase: 'other',
  capturedOn,
  description: '',
  isPublic: false,
  uploaderId: 'u',
  uploaderRole: 'staff',
  uploaderName: null,
  createdAt: '2026-10-07T00:00:00Z',
  archived: false,
  version: 1,
});

describe('groupPhotosByDate (REQ-210 촬영일 기준 묶음)', () => {
  it('입력 순서를 유지하며 같은 촬영일끼리 묶고, 촬영일 없음은 마지막', () => {
    const groups = groupPhotosByDate([
      photo('a', '2026-10-07'),
      photo('n', null),
      photo('b', '2026-10-07'),
      photo('c', '2026-10-05'),
    ]);
    expect(groups.map((g) => [g.date, g.items.map((i) => i.id)])).toEqual([
      ['2026-10-07', ['a', 'b']],
      ['2026-10-05', ['c']],
      [null, ['n']],
    ]);
  });
  it('빈 입력은 빈 배열', () => {
    expect(groupPhotosByDate([])).toEqual([]);
  });
});

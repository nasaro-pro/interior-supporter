import { describe, expect, it } from 'vitest';
import { pickSite, type FieldSite } from './site';

const a: FieldSite = { projectId: 'p-a', name: '강남 A현장', siteAddress: '' };
const b: FieldSite = { projectId: 'p-b', name: '성수 B현장', siteAddress: '' };

describe('pickSite (REQ-220 · C-T05, C-T06)', () => {
  it('유효 배정 0개 → 안내 (만료·회수 포함)', () => {
    expect(pickSite([], null)).toEqual({ kind: 'none' });
    expect(pickSite([], 'p-a')).toEqual({ kind: 'none' });
  });
  it('1개면 자동 선택', () => {
    expect(pickSite([a], null)).toEqual({ kind: 'selected', site: a });
  });
  it('여러 개면 선택 요구, 선택한 현장은 그대로', () => {
    expect(pickSite([a, b], null)).toEqual({ kind: 'choose' });
    expect(pickSite([a, b], 'p-b')).toEqual({ kind: 'selected', site: b });
  });
  it('배정되지 않은 현장 id 요청은 거부 (다른 현장 ID 바꿔치기)', () => {
    expect(pickSite([a, b], 'p-zzz')).toEqual({ kind: 'denied' });
  });
});

import { describe, expect, it } from 'vitest';
import { buildRequestThread } from './thread';

const names = new Map([
  ['u1', '고객1'],
  ['pm1', 'PM1'],
]);

describe('buildRequestThread (REQ-202 · POL-019)', () => {
  it('원문 → 정정 → 답변을 서버 시각순으로 섞어 보여 준다', () => {
    const entries = buildRequestThread(
      { id: 'r', body: '원문', authorId: 'u1', createdAt: '2026-10-07T01:00:00Z' },
      [{ id: 'c1', body: '정정', authorId: 'u1', createdAt: '2026-10-07T03:00:00Z' }],
      [{ id: 'p1', body: '답변', authorId: 'pm1', createdAt: '2026-10-07T02:00:00Z' }],
      names,
    );
    expect(entries.map((e) => [e.kind, e.id])).toEqual([
      ['original', 'r'],
      ['reply', 'p1'],
      ['correction', 'c1'],
    ]);
    expect(entries[1]?.authorName).toBe('PM1');
  });

  it('같은 시각이면 원문 < 정정 < 답변, 그다음 id 순', () => {
    const at = '2026-10-07T01:00:00Z';
    const entries = buildRequestThread(
      { id: 'r', body: '원문', authorId: 'u1', createdAt: at },
      [{ id: 'c2', body: 'b', authorId: 'u1', createdAt: at }],
      [
        { id: 'p2', body: 'b', authorId: 'pm1', createdAt: at },
        { id: 'p1', body: 'a', authorId: 'pm1', createdAt: at },
      ],
      names,
    );
    expect(entries.map((e) => e.id)).toEqual(['r', 'c2', 'p1', 'p2']);
  });

  it('프로필을 볼 수 없으면 이름은 null', () => {
    const [first] = buildRequestThread(
      { id: 'r', body: 'x', authorId: 'zz', createdAt: '2026-10-07T01:00:00Z' },
      [],
      [],
      names,
    );
    expect(first?.authorName).toBeNull();
  });
});

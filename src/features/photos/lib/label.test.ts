import { describe, expect, it } from 'vitest';
import { photoLabel } from './label';

describe('photoLabel (C-11)', () => {
  it('설명이 있으면 설명', () => {
    expect(
      photoLabel({ id: 'abcdef123', description: ' 욕실 벽 ', captured_on: '2026-10-05' }),
    ).toBe('욕실 벽');
  });
  it('설명이 비면 촬영일', () => {
    expect(photoLabel({ id: 'abcdef123', description: '  ', captured_on: '2026-10-05' })).toBe(
      '2026-10-05',
    );
  });
  it('촬영일도 없으면 등록일(KST) — UTC 15시 이후는 다음 날', () => {
    expect(
      photoLabel({
        id: 'abcdef123',
        description: '',
        captured_on: null,
        created_at: '2026-10-06T16:00:00Z',
      }),
    ).toBe('2026-10-07');
  });
  it('아무 값도 없으면 id 앞 8자 — 빈 제목은 없다', () => {
    expect(photoLabel({ id: 'abcdef1234567', description: null, captured_on: null })).toBe(
      'abcdef12',
    );
  });
});

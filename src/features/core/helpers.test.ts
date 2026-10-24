// TC-904 safeNext · REQ-014 고객 홈 영역 · 목록 커서 · URL 쿼리 — 정상·예외
import { describe, expect, it } from 'vitest';
import { safeNext } from '@/shared/contracts/routes';
import { moveSection, normalizeHomeSections, DEFAULT_HOME_SECTIONS } from './home-sections';
import { decodeCursor, encodeCursor, sanitizeSearch } from './server/list-utils';
import { withQuery } from './url';

describe('TC-904 safeNext (오픈 리다이렉트 방지)', () => {
  it('TC-904 같은 사이트 상대 경로는 허용한다', () => {
    expect(safeNext('/app/studio/projects')).toBe('/app/studio/projects');
  });
  it('TC-904 외부·프로토콜 상대·역슬래시 경로는 기본값으로 바꾼다', () => {
    expect(safeNext('https://evil.example')).toBe('/select-area');
    expect(safeNext('//evil.example')).toBe('/select-area');
    expect(safeNext('/\\evil.example')).toBe('/select-area');
    expect(safeNext(null)).toBe('/select-area');
  });
});

describe('REQ-014 고객 홈 영역', () => {
  it('TC-014 잘못된 jsonb 는 4키 순열로 보정한다', () => {
    expect(normalizeHomeSections(null)).toEqual(DEFAULT_HOME_SECTIONS);
    const fixed = normalizeHomeSections([{ key: 'documents', visible: false }, { key: 'bad' }]);
    expect(fixed.map((s) => s.key)).toEqual(['documents', 'overview', 'recent', 'schedule']);
    expect(fixed[0]?.visible).toBe(false);
  });
  it('TC-014 위·아래 이동, 끝에서는 그대로', () => {
    const moved = moveSection(DEFAULT_HOME_SECTIONS, 1, -1);
    expect(moved.map((s) => s.key)).toEqual(['recent', 'overview', 'schedule', 'documents']);
    expect(moveSection(DEFAULT_HOME_SECTIONS, 0, -1)).toBe(DEFAULT_HOME_SECTIONS);
  });
});

describe('목록 커서·검색어', () => {
  it('커서는 왕복한다', () => {
    const c = encodeCursor('2026-10-07T01:02:03.123+00:00', '11111111-1111-4111-8111-111111111111');
    expect(decodeCursor(c)).toEqual({
      at: '2026-10-07T01:02:03.123+00:00',
      id: '11111111-1111-4111-8111-111111111111',
    });
  });
  it('조작된 커서는 무시한다 (첫 페이지)', () => {
    expect(decodeCursor('not-base64')).toBeNull();
    expect(decodeCursor(Buffer.from('["x","y"]').toString('base64url'))).toBeNull();
  });
  it('검색어의 필터 구문 문자를 제거한다', () => {
    expect(sanitizeSearch('a,b),id.eq.1%')).toBe('a b id.eq.1');
  });
});

describe('withQuery', () => {
  it('빈 값은 빼고 쿼리를 붙인다', () => {
    expect(withQuery('/app/s/projects', { q: '반포', status: undefined, cursor: 'c1' })).toBe(
      '/app/s/projects?q=%EB%B0%98%ED%8F%AC&cursor=c1',
    );
    expect(withQuery('/app/s/projects?status=active', { status: '' })).toBe('/app/s/projects');
  });
});

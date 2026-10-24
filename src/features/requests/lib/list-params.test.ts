import { describe, expect, it } from 'vitest';
import {
  escapeLike,
  isUuid,
  parseRequestListParams,
  requestListHref,
  withQuery,
} from './list-params';

describe('parseRequestListParams', () => {
  it('기본값', () => {
    expect(parseRequestListParams({}, 'editor')).toEqual({
      q: '',
      status: null,
      archived: false,
      size: 30,
    });
  });
  it('열거형 밖 status 는 무시하고 검색어는 다듬는다', () => {
    const f = parseRequestListParams({ status: 'closed', q: '  타일  ' }, 'editor');
    expect(f.status).toBeNull();
    expect(f.q).toBe('타일');
  });
  it('보관함은 편집자만 (고객이 archived=1 을 보내도 무시)', () => {
    expect(parseRequestListParams({ archived: '1' }, 'editor').archived).toBe(true);
    expect(parseRequestListParams({ archived: '1' }, 'customer').archived).toBe(false);
  });
  it('size 는 30 단위로 30~300', () => {
    expect(parseRequestListParams({ size: '45' }, 'editor').size).toBe(30);
    expect(parseRequestListParams({ size: '90' }, 'editor').size).toBe(90);
    expect(parseRequestListParams({ size: '9999' }, 'editor').size).toBe(300);
    expect(parseRequestListParams({ size: ['60', '90'] }, 'editor').size).toBe(60);
  });
});

describe('requestListHref', () => {
  it('기본값은 query 에 넣지 않는다', () => {
    const f = parseRequestListParams({}, 'editor');
    expect(requestListHref('/p/requests', f, {})).toBe('/p/requests');
    expect(requestListHref('/p/requests', f, { status: 'open', size: 60 })).toBe(
      '/p/requests?status=open&size=60',
    );
  });
});

describe('escapeLike', () => {
  it('%·_·\\ 를 이스케이프한다', () => {
    expect(escapeLike('50%_a\\b')).toBe('50\\%\\_a\\\\b');
  });
});

describe('withQuery', () => {
  it('값이 있는 것만 붙이고 기존 query 뒤에는 & 로 잇는다', () => {
    expect(withQuery('/p/requests', { mode: 'new', x: null })).toBe('/p/requests?mode=new');
    expect(withQuery('/p?a=1', { mode: 'edit' })).toBe('/p?a=1&mode=edit');
    expect(withQuery('/p', {})).toBe('/p');
  });
});

describe('isUuid', () => {
  it('uuid 형식만 통과', () => {
    expect(isUuid('3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

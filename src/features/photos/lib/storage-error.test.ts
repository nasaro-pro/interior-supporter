import { describe, expect, it } from 'vitest';
import { isAlreadyExistsError } from './storage-error';

describe('isAlreadyExistsError (C-07)', () => {
  it('정상: 409(status·statusCode) 는 이미 올라간 객체로 본다', () => {
    expect(isAlreadyExistsError({ status: 409, message: 'x' })).toBe(true);
    expect(
      isAlreadyExistsError({ statusCode: '409', message: 'The resource already exists' }),
    ).toBe(true);
  });

  it('상태 코드가 없으면 "already exists" · "Duplicate" 문구만 보조 판정', () => {
    expect(isAlreadyExistsError({ message: 'The resource already exists' })).toBe(true);
    expect(isAlreadyExistsError({ message: 'Duplicate' })).toBe(true);
    expect(isAlreadyExistsError({ error: 'Duplicate', message: 'x' })).toBe(true);
  });

  it('예외: "does not exist" 같은 없음 오류는 통과시키지 않는다 (오탐 방지)', () => {
    expect(isAlreadyExistsError({ message: 'Bucket does not exist' })).toBe(false);
    expect(isAlreadyExistsError({ statusCode: '404', message: 'Object not found' })).toBe(false);
    expect(isAlreadyExistsError({ status: 400, message: 'already exists' })).toBe(false);
  });

  it('권한 오류(403·서명 만료)는 실패로 둔다', () => {
    expect(
      isAlreadyExistsError({
        statusCode: '403',
        message: 'new row violates row-level security policy',
      }),
    ).toBe(false);
    expect(isAlreadyExistsError({ status: 400, message: 'invalid signature' })).toBe(false);
  });

  it('null·문자열 등 비정상 입력은 false', () => {
    expect(isAlreadyExistsError(null)).toBe(false);
    expect(isAlreadyExistsError('already exists')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { redirectPath } from './redirect';

describe('redirectPath', () => {
  it('Location 을 상대 경로 그대로 둔다 (프록시 내부 주소가 새지 않음)', () => {
    const res = redirectPath('/login?next=%2Fc%2Fstudio-x%2Fmy', 303);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/login?next=%2Fc%2Fstudio-x%2Fmy');
  });

  it('기본 상태는 307', () => {
    expect(redirectPath('/portal/projects').status).toBe(307);
  });

  it('바깥 주소·프로토콜 상대 주소는 거부한다', () => {
    expect(() => redirectPath('https://evil.example')).toThrow();
    expect(() => redirectPath('//evil.example')).toThrow();
    expect(() => redirectPath('/\\evil.example')).toThrow();
  });

  it('쿠키를 함께 실을 수 있다', () => {
    const res = redirectPath('/portal/projects/p1/home');
    res.cookies.set('x', '1');
    expect(res.headers.get('set-cookie')).toContain('x=1');
  });
});

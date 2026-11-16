import { describe, expect, it } from 'vitest';
import { checkSns, cleanSnsList } from './sns';

describe('checkSns', () => {
  it('종류 알아보기', () => {
    expect(checkSns('https://instagram.com/houseon.interior')).toEqual({
      ok: true,
      kind: 'instagram',
      url: 'https://instagram.com/houseon.interior',
    });
    expect(checkSns('https://www.youtube.com/@houseon')).toMatchObject({ kind: 'youtube' });
    expect(checkSns('https://m.blog.naver.com/houseon')).toMatchObject({ kind: 'blog' });
    expect(checkSns('https://pf.kakao.com/_xAbc')).toMatchObject({ kind: 'kakao' });
    expect(checkSns('https://houseon.co.kr/about')).toMatchObject({ kind: 'web' });
  });
  it('https:// 없이 붙여넣어도 받는다', () => {
    expect(checkSns(' instagram.com/houseon ')).toEqual({
      ok: true,
      kind: 'instagram',
      url: 'https://instagram.com/houseon',
    });
  });
  it('거절: http, 계정 없는 SNS 주소, 이상한 주소', () => {
    expect(checkSns('http://instagram.com/x')).toEqual({ ok: false, error: 'insecure' });
    expect(checkSns('https://instagram.com/')).toEqual({ ok: false, error: 'invalid' });
    expect(checkSns('hello world')).toEqual({ ok: false, error: 'invalid' });
    expect(checkSns('localhost')).toEqual({ ok: false, error: 'invalid' });
    expect(checkSns('https://a.com/' + 'x'.repeat(300))).toEqual({ ok: false, error: 'tooLong' });
  });
  it('목록 정리: 빈 칸·잘못된 것·중복 빼고 최대 5개', () => {
    expect(
      cleanSnsList([
        '',
        'instagram.com/a',
        'https://instagram.com/a',
        'http://x.com',
        'b.com',
        'c.com',
        'd.com',
        'e.com',
        'f.com',
      ]),
    ).toEqual([
      'https://instagram.com/a',
      'https://b.com',
      'https://c.com',
      'https://d.com',
      'https://e.com',
    ]);
  });
});

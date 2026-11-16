import { describe, expect, it } from 'vitest';
import { cleanLabels, labelText } from './labels';

describe('공개 페이지 문구', () => {
  it('정리: 모르는 칸·빈 글·너무 긴 글·제목 숨김은 버린다', () => {
    expect(
      cleanLabels({
        introKicker: '  HOUSEON  ',
        worksKicker: false,
        worksTitle: false,
        followUs: '',
        hero: 'x',
        contact: 'C'.repeat(31),
      }),
    ).toEqual({ introKicker: 'HOUSEON', worksKicker: false });
    expect(cleanLabels(null)).toEqual({});
    expect(cleanLabels(['a'])).toEqual({});
  });
  it('보여 줄 문구: 직접 쓴 글 > 기본, false 면 숨김(제목은 숨기지 않음)', () => {
    const l = { worksKicker: 'OUR WORKS', followUs: false as const };
    expect(labelText(l, 'worksKicker', 'Selected Works')).toBe('OUR WORKS');
    expect(labelText(l, 'followUs', 'FOLLOW US')).toBeNull();
    expect(labelText(l, 'contact', 'CONTACT')).toBe('CONTACT');
    expect(labelText({ worksTitle: false }, 'worksTitle', '시공 사례')).toBe('시공 사례');
    expect(labelText(undefined, 'introKicker', 'PORTFOLIO')).toBe('PORTFOLIO');
  });
});

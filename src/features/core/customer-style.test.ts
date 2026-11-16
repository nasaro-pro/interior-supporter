// 고객 화면 제목 글꼴 · 굵기 — DB CHECK 와 같은 값만, 나머지는 기본값(노토 산스 · 600)
import { describe, expect, it } from 'vitest';
import { customerTitleVars, normalizeTitleFont, normalizeTitleWeight } from './customer-style';

describe('customer-style', () => {
  it('알 수 없는 값은 기본값', () => {
    expect(normalizeTitleFont('comic')).toBe('noto_sans');
    expect(normalizeTitleFont('noto_serif')).toBe('noto_serif');
    expect(normalizeTitleWeight(700)).toBe(600);
    expect(normalizeTitleWeight(400)).toBe(400);
  });
  it('명조는 --font-brand-serif, 굵기는 숫자 그대로', () => {
    const v = customerTitleVars('noto_serif', 500) as Record<string, string>;
    expect(v['--customer-title-font']).toContain('--font-brand-serif');
    expect(v['--customer-title-weight']).toBe('500');
  });
});

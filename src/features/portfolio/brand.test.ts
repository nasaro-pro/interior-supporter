// 브랜드 색 대비를 계산으로 확인 (WCAG 2.1: 본문 4.5:1, 굵은 큰 글자 3:1)
import { describe, expect, it } from 'vitest';
import { BRAND, FOOTER_TONES, TONE_HEX, footerColors, normalizeFooterTone } from './brand';
import type { PortfolioTone } from './brand';

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

describe('브랜드 대비', () => {
  for (const [tone, { canvas, surface }] of Object.entries(TONE_HEX)) {
    it(`${tone}: 본문·보조 글자가 바탕·시트에서 4.5:1 이상`, () => {
      for (const bg of [canvas, surface, BRAND.card]) {
        expect(ratio(BRAND.foreground, bg)).toBeGreaterThanOrEqual(4.5);
        expect(ratio(BRAND.mutedForeground, bg)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
  it('보조 글자는 muted·accent 면에서도 4.5:1 이상', () => {
    expect(ratio(BRAND.mutedForeground, BRAND.muted)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(BRAND.mutedForeground, BRAND.accent)).toBeGreaterThanOrEqual(4.5);
  });
  it('주 버튼 글자 4.5:1 이상, 포커스 링(=primary)은 바탕에서 3:1 이상', () => {
    expect(ratio(BRAND.primaryForeground, BRAND.primary)).toBeGreaterThanOrEqual(4.5);
    for (const { canvas } of Object.values(TONE_HEX)) {
      expect(ratio(BRAND.primary, canvas)).toBeGreaterThanOrEqual(3);
    }
  });
  it('Stitch 원래 보조 글자(#6B655C)는 샌드·클레이에서 미달이었다 (값을 바꾼 이유)', () => {
    expect(ratio('#6B655C', TONE_HEX.sand.canvas)).toBeLessThan(4.5);
    expect(ratio('#6B655C', TONE_HEX.clay.canvas)).toBeLessThan(4.5);
  });
});

describe('바닥 칸 색 (분위기 8 × 바닥 3 = 24 조합)', () => {
  for (const tone of Object.keys(TONE_HEX) as PortfolioTone[]) {
    for (const ft of FOOTER_TONES) {
      it(`${tone} · ${ft}: 본문·보조 글자 4.5:1 이상`, () => {
        const c = footerColors(tone, ft);
        expect(ratio(c.fg, c.bg)).toBeGreaterThanOrEqual(4.5);
        expect(ratio(c.muted, c.bg)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  it('모르는 값은 soft', () => {
    expect(normalizeFooterTone('black')).toBe('soft');
    expect(normalizeFooterTone('deep')).toBe('deep');
  });
});

describe('글꼴', () => {
  it('제목·본문 글꼴 변수 — 모르는 값은 기본(제목·본문 모두 노토 산스)', async () => {
    const { fontStyle, FONT_STACK } = await import('./brand');
    const s = fontStyle('noto_sans', 'system') as Record<string, string>;
    expect(s['--pf-title']).toBe(FONT_STACK.noto_sans);
    expect(s.fontFamily).toContain('Malgun Gothic');
    const d = fontStyle('comic', 'serif') as Record<string, string>;
    expect(d['--pf-title']).toBe(FONT_STACK.noto_sans);
    expect(d.fontFamily).toBe(FONT_STACK.noto_sans);
    const none = fontStyle(undefined, undefined) as Record<string, string>;
    expect(none['--pf-title']).toBe(FONT_STACK.noto_sans);
    expect(none.fontFamily).toBe(FONT_STACK.noto_sans);
    expect(d['--pf-title-weight']).toBe('600');
    expect(
      (fontStyle('serif', 'pretendard', 400) as Record<string, string>)['--pf-title-weight'],
    ).toBe('400');
    expect(
      (fontStyle('serif', 'pretendard', 700) as Record<string, string>)['--pf-title-weight'],
    ).toBe('600');
  });
});

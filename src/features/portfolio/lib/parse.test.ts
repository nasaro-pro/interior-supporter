import { describe, expect, it } from 'vitest';
import { parsePortfolio, parseWork, shareCover } from './parse';

const company = {
  slug: 'kingwang',
  name: '킹왕짱인테리어',
  intro: '오래 살아도 편한 집',
  address: '',
  csHours: '',
  logoPath: null,
  pageTone: 'ivory',
  contactUrl: null,
  businessName: '',
  contactPhone: '02-512-3400',
  businessRegNo: null,
  representative: '',
};
const cover = {
  path: 'c/w/1.webp',
  thumbPath: 'c/w/1_t.webp',
  width: 2000,
  height: 1500,
  caption: '',
};
const W1 = '40000000-0000-0000-0000-000000000001';

describe('parsePortfolio (get_public_portfolio)', () => {
  it('실제 RPC 모양을 그대로 받는다 (db-check 41번 결과와 같은 모양)', () => {
    const r = parsePortfolio({
      company,
      works: [
        {
          id: W1,
          cover,
          title: '청담동 32평',
          spaces: ['living', 'kitchen'],
          areaLabel: '청담동',
          isFeatured: true,
          sizePyeong: 32.0,
          completedOn: null,
          durationWeeks: 9,
        },
      ],
    });
    expect(r?.company.pageTone).toBe('ivory');
    expect(r?.works[0]).toMatchObject({
      id: W1,
      sizePyeong: 32,
      durationWeeks: 9,
      isFeatured: true,
    });
  });
  it('공개가 꺼졌으면(null) null, 모르는 분위기는 기본, 모르는 공간·깨진 사례는 버림', () => {
    expect(parsePortfolio(null)).toBeNull();
    const r = parsePortfolio({
      company: { ...company, pageTone: 'neon' },
      works: [
        {
          id: W1,
          cover: null,
          title: 'a',
          spaces: ['living', 'garage'],
          areaLabel: '',
          isFeatured: false,
          sizePyeong: null,
          completedOn: null,
          durationWeeks: null,
        },
        { id: 'not-uuid', title: 'broken' },
      ],
    });
    expect(r?.company.pageTone).toBe('default');
    expect(r?.works).toHaveLength(1);
    expect(r?.works[0]!.spaces).toEqual(['living']);
  });
});

describe('대표 사례 수', () => {
  it('없거나 범위 밖이면 1~6 으로 (기본 3)', () => {
    expect(parsePortfolio({ company, works: [] })?.company.featuredLimit).toBe(3);
    expect(
      parsePortfolio({ company: { ...company, featuredLimit: 5 }, works: [] })?.company
        .featuredLimit,
    ).toBe(5);
    expect(
      parsePortfolio({ company: { ...company, featuredLimit: 40 }, works: [] })?.company
        .featuredLimit,
    ).toBe(6);
  });
});

describe('parseWork (get_public_portfolio_work)', () => {
  it('사진·업체 정보까지', () => {
    const w = parseWork({
      id: W1,
      title: '청담동 32평',
      areaLabel: '청담동',
      sizePyeong: 32,
      spaces: ['living'],
      completedOn: '2026-11-20',
      durationWeeks: 9,
      summary: '설명',
      company,
      images: [
        {
          id: '50000000-0000-0000-0000-000000000001',
          path: 'p',
          thumbPath: 't',
          width: 2000,
          height: 1500,
          thumbWidth: 640,
          thumbHeight: 480,
          space: 'bedroom',
          spaceLabel: '침실A',
          caption: '',
          role: 'gallery',
        },
        { id: 'bad' },
      ],
    });
    expect(w?.images).toHaveLength(1);
    expect(w?.images[0]!.spaceLabel).toBe('침실A');
    expect(w?.company.name).toBe('킹왕짱인테리어');
  });
  it('null 이면 null', () => expect(parseWork(null)).toBeNull());
});

describe('shareCover', () => {
  it('대표 사례 사진 → 없으면 첫 사진', () => {
    const base = {
      title: '',
      areaLabel: '',
      sizePyeong: null,
      spaces: [],
      completedOn: null,
      durationWeeks: null,
    };
    const other = { ...cover, path: 'other' };
    expect(
      shareCover([
        { ...base, id: 'a', isFeatured: false, cover: other },
        { ...base, id: 'b', isFeatured: true, cover },
      ])?.path,
    ).toBe('c/w/1.webp');
    expect(
      shareCover([
        { ...base, id: 'a', isFeatured: false, cover: null },
        { ...base, id: 'b', isFeatured: false, cover: other },
      ])?.path,
    ).toBe('other');
  });
});

describe('홈페이지 이름 · 작은 문구', () => {
  it('사이트 관리자가 정한 홈페이지 이름이 있으면 name 이 그 이름 (빈 글은 무시)', () => {
    expect(
      parsePortfolio({ company: { ...company, siteName: '킹왕짱 스튜디오' }, works: [] })?.company,
    ).toMatchObject({ name: '킹왕짱 스튜디오', siteName: '킹왕짱 스튜디오' });
    expect(
      parsePortfolio({ company: { ...company, siteName: '  ' }, works: [] })?.company,
    ).toMatchObject({ name: '킹왕짱인테리어', siteName: null });
  });
  it('작은 문구는 정리해서 받는다', () => {
    expect(
      parsePortfolio({
        company: {
          ...company,
          labels: { worksKicker: 'OUR WORKS', followUs: false, worksTitle: false, x: 1 },
        },
        works: [],
      })?.company.labels,
    ).toEqual({ worksKicker: 'OUR WORKS', followUs: false });
  });
});

describe('로고 숨기기', () => {
  it('true 일 때만 숨김', () => {
    expect(
      parsePortfolio({ company: { ...company, logoHidden: true }, works: [] })?.company.logoHidden,
    ).toBe(true);
    expect(parsePortfolio({ company, works: [] })?.company.logoHidden).toBe(false);
  });
});

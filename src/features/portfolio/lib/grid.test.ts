import { describe, expect, it } from 'vitest';
import {
  clampFeaturedLimit,
  slideshowWorks,
  beforeAfterPair,
  buildSpaceTabs,
  filterBySpace,
  footerRows,
  metaLine,
  parseSpace,
  spaceCounts,
  stepIndex,
  type PublicCompany,
  type PublicWorkCard,
  type PublicWorkImage,
} from './grid';

const cover = { path: 'p', thumbPath: 't', width: 1, height: 1, caption: '' };
const work = (
  id: string,
  spaces: PublicWorkCard['spaces'],
  isFeatured = false,
): PublicWorkCard => ({
  id,
  title: id,
  areaLabel: '청담동',
  sizePyeong: 32,
  spaces,
  completedOn: '2026-11-20',
  durationWeeks: 9,
  isFeatured,
  cover,
});
const works = [
  work('a', ['living', 'kitchen'], true),
  work('b', ['bathroom']),
  work('c', ['living']),
];

describe('목록', () => {
  it('?space= 값은 아는 공간만, 나머지는 전체', () => {
    expect(parseSpace('kitchen')).toBe('kitchen');
    expect(parseSpace(['living', 'x'])).toBe('living');
    expect(parseSpace('garage')).toBeNull();
    expect(parseSpace(undefined)).toBeNull();
  });
  it('칩·탭 순서는 집을 둘러보는 순서 (침실이 욕실보다 앞)', () => {
    const r = spaceCounts([work('x', ['bathroom', 'bedroom', 'entrance', 'living'])]);
    expect(r.map((c) => c.space)).toEqual(['living', 'bedroom', 'bathroom', 'entrance']);
  });
  it('공간 거르기와 칩', () => {
    expect(filterBySpace(works, 'living').map((w) => w.id)).toEqual(['a', 'c']);
    expect(spaceCounts(works)).toEqual([
      { space: 'living', count: 2 },
      { space: 'kitchen', count: 1 },
      { space: 'bathroom', count: 1 },
    ]);
  });
  it('한 줄 정보: 지역 · 평수 · 공사 기간 · 완공 연월', () => {
    const label = { pyeong: (n: string) => `${n}평`, weeks: (n: number) => `${n}주` };
    expect(metaLine(works[0]!, label)).toBe('청담동 · 32평 · 9주 · 2026. 11.');
    expect(
      metaLine({ areaLabel: '', sizePyeong: 24.5, completedOn: null, durationWeeks: null }, label),
    ).toBe('24.5평');
  });
});

const img = (
  id: string,
  role: PublicWorkImage['role'],
  space: PublicWorkImage['space'],
  spaceLabel = '',
) =>
  ({
    id,
    role,
    space,
    spaceLabel,
    path: id,
    thumbPath: id,
    width: 1,
    height: 1,
    thumbWidth: 1,
    thumbHeight: 1,
    caption: '',
  }) as PublicWorkImage;

describe('슬라이드 사진 (업체가 정한 대표 사례 수)', () => {
  const many = (n: number, featured: string[] = []) =>
    Array.from({ length: n }, (_, i) => work(`w${i}`, [], featured.includes(`w${i}`)));
  it('대표를 먼저, 정한 수만큼', () => {
    expect(slideshowWorks(many(6, ['w4', 'w2']), 2).map((w) => w.id)).toEqual(['w2', 'w4']);
  });
  it('대표가 모자라면 다른 사례로 채운다', () => {
    expect(slideshowWorks(many(6, ['w3']), 4).map((w) => w.id)).toEqual(['w3', 'w0', 'w1', 'w2']);
  });
  it('수를 줄여 대표가 넘치면 앞쪽만', () => {
    expect(slideshowWorks(many(5, ['w0', 'w1', 'w2', 'w3']), 1).map((w) => w.id)).toEqual(['w0']);
  });
  it('사진 없는 사례는 건너뛰고, 범위 밖 값은 1~6 으로', () => {
    const list = many(8);
    list[0] = { ...list[0]!, cover: null };
    expect(slideshowWorks(list, 99)).toHaveLength(6);
    expect(slideshowWorks(list, 0).map((w) => w.id)).toEqual(['w1']);
    expect(slideshowWorks([], 3)).toEqual([]);
    expect(clampFeaturedLimit(null)).toBe(3);
    expect(clampFeaturedLimit('5')).toBe(5);
  });
});

describe('상세', () => {
  it('비포·애프터가 모두 있을 때만 짝', () => {
    expect(
      beforeAfterPair([img('b', 'before', 'living'), img('a', 'after', 'living')])?.before.id,
    ).toBe('b');
    expect(beforeAfterPair([img('b', 'before', null)])).toBeNull();
  });

  it('공간 탭: 전체 + 공간·이름별, 비포 제외, 공간 없음은 맨 뒤', () => {
    const tabs = buildSpaceTabs([
      img('x', 'gallery', null),
      img('bB', 'gallery', 'bedroom', '침실B'),
      img('bA', 'gallery', 'bedroom', '침실A'),
      img('l1', 'gallery', 'living'),
      img('aft', 'after', 'living'),
      img('bef', 'before', 'living'),
      img('bA2', 'gallery', 'bedroom', '침실A'),
    ]);
    expect(tabs.map((t) => t.key)).toEqual([
      'all',
      'living:',
      'bedroom:침실A',
      'bedroom:침실B',
      'none:',
    ]);
    expect(tabs[0]!.items).toHaveLength(6);
    expect(tabs.find((t) => t.key === 'living:')!.items.map((i) => i.id)).toEqual(['l1', 'aft']);
    expect(tabs.find((t) => t.key === 'bedroom:침실A')!.items.map((i) => i.id)).toEqual([
      'bA',
      'bA2',
    ]);
  });

  it('사진이 없으면 탭도 없다', () => {
    expect(buildSpaceTabs([img('bef', 'before', 'living')])).toEqual([]);
  });

  it('넘기기는 끝에서 처음으로 돈다', () => {
    expect(stepIndex(0, -1, 5)).toBe(4);
    expect(stepIndex(4, 1, 5)).toBe(0);
    expect(stepIndex(2, 1, 5)).toBe(3);
    expect(stepIndex(0, 1, 0)).toBe(0);
  });
});

describe('푸터', () => {
  const c: PublicCompany = {
    slug: 'k',
    name: '킹왕짱인테리어',
    contactPhone: '02-512-3400',
    contactUrl: null,
    pageTone: 'ivory',
    logoPath: null,
    businessName: '',
    representative: '이재서',
    businessRegNo: null,
    address: '',
    csHours: '평일 09:00~18:00',
    featuredLimit: 3,
  };
  it('값이 있는 줄만, 상호가 비면 업체명 (전화·상담 시간은 CONTACT 칸으로 옮김)', () => {
    expect(footerRows(c)).toEqual([
      ['businessName', '킹왕짱인테리어'],
      ['representative', '이재서'],
    ]);
    expect(
      footerRows({ ...c, mailOrderNo: '제2026-서울강남-00001호', address: '서울 강남구' }),
    ).toEqual([
      ['businessName', '킹왕짱인테리어'],
      ['representative', '이재서'],
      ['mailOrderNo', '제2026-서울강남-00001호'],
      ['address', '서울 강남구'],
    ]);
  });
});

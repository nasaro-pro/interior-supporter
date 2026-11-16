import { describe, expect, it } from 'vitest';
import { areaLabelSchema, portfolioSettingsSchema, weeksBetween } from './schema';

describe('weeksBetween (공사 기간 자동 계산)', () => {
  it('시작·끝 포함, 주 단위 올림', () => {
    expect(weeksBetween('2026-09-20', '2026-11-20')).toBe(9); // 62일
    expect(weeksBetween('2026-11-01', '2026-11-07')).toBe(1);
    expect(weeksBetween('2026-11-01', '2026-11-08')).toBe(2);
  });
  it('기간이 없거나 거꾸로면 null', () => {
    expect(weeksBetween(null, '2026-11-20')).toBeNull();
    expect(weeksBetween('2026-11-20', '2026-11-01')).toBeNull();
  });
});

describe('입력 검사', () => {
  it('지역은 동네까지만', () => {
    expect(areaLabelSchema.safeParse('분당구 정자동').success).toBe(true);
    expect(areaLabelSchema.safeParse('청담동 123-4').success).toBe(false);
    expect(areaLabelSchema.safeParse('래미안 101동 1203호').success).toBe(false);
  });
  const base = {
    companyId: '10000000-0000-4000-8000-000000000001',
    baseVersion: null,
    isPublic: true,
    intro: '',
    contactPhone: null,
    contactUrl: null,
    pageTone: 'ivory',
    businessName: '',
    representative: '',
    address: '',
    csHours: '',
    featuredLimit: 3,
    businessRegNo: null as string | null,
    footerSlogan: '',
    contactEmail: null as string | null,
    mailOrderNo: null as string | null,
    snsLinks: [] as string[],
    footerTone: 'soft',
    worksLayout: 'gallery',
    galleryFilter: true,
    carouselPer: 3,
    titleFont: 'serif',
    bodyFont: 'pretendard',
    titleWeight: 600,
    mobileWorksLayout: null as string | null,
    mobileGalleryCols: 2,
    pageLabels: {} as Record<string, unknown>,
    logoHidden: false,
  };
  it('글꼴: 제목 4가지 · 본문 3가지(명조 본문 없음)', () => {
    expect(
      portfolioSettingsSchema.safeParse({ ...base, titleFont: 'noto_sans', bodyFont: 'system' })
        .success,
    ).toBe(true);
    expect(portfolioSettingsSchema.safeParse({ ...base, bodyFont: 'serif' }).success).toBe(false);
    expect(portfolioSettingsSchema.safeParse({ ...base, titleFont: 'malgun' }).success).toBe(false);
    expect(portfolioSettingsSchema.safeParse({ ...base, titleWeight: 400 }).success).toBe(true);
    expect(portfolioSettingsSchema.safeParse({ ...base, titleWeight: 700 }).success).toBe(false);
  });
  it('휴대폰 배열은 비우면 PC와 같게, 칸 수는 1·2', () => {
    expect(
      portfolioSettingsSchema.safeParse({
        ...base,
        mobileWorksLayout: 'list',
        mobileGalleryCols: 1,
      }).success,
    ).toBe(true);
    expect(portfolioSettingsSchema.safeParse({ ...base, mobileWorksLayout: null }).success).toBe(
      true,
    );
    expect(portfolioSettingsSchema.safeParse({ ...base, mobileGalleryCols: 3 }).success).toBe(
      false,
    );
  });
  it('분위기: 화이트(default)·종이색(paper)은 포트폴리오에서만', () => {
    expect(portfolioSettingsSchema.safeParse({ ...base, pageTone: 'default' }).success).toBe(true);
    expect(portfolioSettingsSchema.safeParse({ ...base, pageTone: 'paper' }).success).toBe(true);
    expect(portfolioSettingsSchema.safeParse({ ...base, pageTone: 'neon' }).success).toBe(false);
  });
  it('작은 문구: 직접 쓰기·숨기기, 제목은 못 숨김, 길이 제한', () => {
    const r = portfolioSettingsSchema.safeParse({
      ...base,
      pageLabels: { worksKicker: ' OUR WORKS ', followUs: false, contact: '' },
    });
    expect(r.success && r.data.pageLabels).toEqual({ worksKicker: 'OUR WORKS', followUs: false });
    expect(
      portfolioSettingsSchema.safeParse({ ...base, pageLabels: { worksTitle: false } }).success,
    ).toBe(false);
    expect(
      portfolioSettingsSchema.safeParse({ ...base, pageLabels: { worksTitle: '가'.repeat(21) } })
        .success,
    ).toBe(false);
  });
  it('사업자등록번호 형식', () => {
    expect(
      portfolioSettingsSchema.safeParse({ ...base, businessRegNo: '123-45-67890' }).success,
    ).toBe(true);
    expect(
      portfolioSettingsSchema.safeParse({ ...base, businessRegNo: '1234567890' }).success,
    ).toBe(false);
  });
  it('대표 사례 수는 1~6', () => {
    expect(portfolioSettingsSchema.safeParse({ ...base, featuredLimit: 6 }).success).toBe(true);
    expect(portfolioSettingsSchema.safeParse({ ...base, featuredLimit: '4' }).success).toBe(true);
    expect(portfolioSettingsSchema.safeParse({ ...base, featuredLimit: 0 }).success).toBe(false);
    expect(portfolioSettingsSchema.safeParse({ ...base, featuredLimit: 7 }).success).toBe(false);
  });
  it('바닥 칸: SNS 는 정리해서 받고 잘못된 주소·6개 이상은 거절', () => {
    const r = portfolioSettingsSchema.safeParse({
      ...base,
      snsLinks: ['instagram.com/a', '', 'https://instagram.com/a'],
    });
    expect(r.success && r.data.snsLinks).toEqual(['https://instagram.com/a']);
    expect(portfolioSettingsSchema.safeParse({ ...base, snsLinks: ['http://a.com'] }).success).toBe(
      false,
    );
    expect(
      portfolioSettingsSchema.safeParse({
        ...base,
        snsLinks: ['a.com', 'b.com', 'c.com', 'd.com', 'e.com', 'f.com'],
      }).success,
    ).toBe(false);
  });
  it('사례 배열: 2가지, 가로 넘김 3·4장만', () => {
    expect(
      portfolioSettingsSchema.safeParse({ ...base, worksLayout: 'carousel', carouselPer: 4 })
        .success,
    ).toBe(true);
    expect(portfolioSettingsSchema.safeParse({ ...base, worksLayout: 'list' }).success).toBe(true);
    expect(portfolioSettingsSchema.safeParse({ ...base, worksLayout: 'masonry' }).success).toBe(
      false,
    );
    expect(portfolioSettingsSchema.safeParse({ ...base, carouselPer: 5 }).success).toBe(false);
  });
  it('바닥 칸: 이메일 모양 · 바닥 색 3가지', () => {
    expect(portfolioSettingsSchema.safeParse({ ...base, contactEmail: 'hello@x.kr' }).success).toBe(
      true,
    );
    expect(portfolioSettingsSchema.safeParse({ ...base, contactEmail: 'hello' }).success).toBe(
      false,
    );
    expect(portfolioSettingsSchema.safeParse({ ...base, footerTone: 'deep' }).success).toBe(true);
    expect(portfolioSettingsSchema.safeParse({ ...base, footerTone: 'black' }).success).toBe(false);
  });
});

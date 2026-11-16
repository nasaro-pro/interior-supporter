import { describe, expect, it } from 'vitest';
import { parseAdminPortfolio } from './admin';

describe('사이트 관리자 공개 홈페이지 칸', () => {
  it('RPC 결과를 화면용으로, 빈 이름은 null', () => {
    expect(
      parseAdminPortfolio({
        slug: 'kingwang',
        companyName: '킹왕짱',
        siteName: ' ',
        isPublic: true,
        publicWorks: '3',
        businessName: '킹왕짱(주)',
        representative: '이재서',
        businessRegNo: null,
        businessLockedAt: '2026-11-09T00:00:00Z',
      }),
    ).toEqual({
      slug: 'kingwang',
      companyName: '킹왕짱',
      siteName: null,
      isPublic: true,
      publicWorks: 3,
      businessName: '킹왕짱(주)',
      representative: '이재서',
      businessRegNo: null,
      businessLockedAt: '2026-11-09T00:00:00Z',
    });
    expect(parseAdminPortfolio(null)).toBeNull();
    expect(parseAdminPortfolio({ slug: '' })).toBeNull();
  });
});

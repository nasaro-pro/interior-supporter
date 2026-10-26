import { describe, expect, it } from 'vitest';
import {
  groupPathsByBucket,
  toCompanyRow,
  toDashboard,
  toSiteSettings,
  toUserRow,
} from './mappers';

describe('RPC 행 → 화면 타입', () => {
  it('대시보드: 빈 결과도 0 으로', () => {
    expect(toDashboard(undefined)).toEqual({
      companies: 0,
      users: 0,
      projects: 0,
      storageBytes: 0,
      signups7d: 0,
      suspendedUsers: 0,
    });
    expect(toDashboard({ companies: 3, storage_bytes: '1024' }).storageBytes).toBe(1024);
  });
  it('업체: 한도 null 유지, 소유자 없으면 null', () => {
    const r = toCompanyRow({
      id: 'c',
      slug: 's',
      name: 'n',
      created_at: 't',
      owner_id: null,
      member_count: 2,
      quota_bytes: null,
    });
    expect(r.quotaBytes).toBeNull();
    expect(r.ownerName).toBeNull();
    expect(r.memberCount).toBe(2);
  });
  it('사용자: 소속 목록·관리자 여부', () => {
    const u = toUserRow({
      id: 'u',
      email: 'e',
      display_name: 'd',
      memberships: [{ company: '가', slug: 'ga', role: 'owner' }],
      is_admin: true,
    });
    expect(u.memberships).toEqual([{ company: '가', slug: 'ga', role: 'owner' }]);
    expect(u.isAdmin).toBe(true);
    expect(u.suspendedAt).toBeNull();
  });
  it('사이트 설정 없음 → null', () => {
    expect(toSiteSettings(null)).toBeNull();
    expect(
      toSiteSettings({
        photo_max_bytes: 10,
        photo_batch_max: 2,
        design_max_bytes: 20,
        default_quota_bytes: null,
      })?.defaultQuotaBytes,
    ).toBeNull();
  });
  it('버킷별로 묶기', () => {
    const g = groupPathsByBucket([
      { bucket: 'project-files', path: 'a' },
      { bucket: 'project-files', path: 'b' },
      { bucket: 'logos', path: 'c' },
    ]);
    expect(g.get('project-files')).toEqual(['a', 'b']);
    expect(g.get('logos')).toEqual(['c']);
  });
});

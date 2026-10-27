import { describe, expect, it } from 'vitest';
import { companyQuotaSchema, siteSettingsSchema } from './schema';

describe('사이트 설정 입력 (A6)', () => {
  it('범위 안 값은 통과, 빈 기본 한도는 null', () => {
    const r = siteSettingsSchema.safeParse({
      photoMaxMb: '20',
      photoBatchMax: '20',
      designMaxMb: '50',
      defaultQuotaGb: '',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.defaultQuotaGb).toBeNull();
  });
  it('범위 밖·소수 장 수는 거절', () => {
    expect(
      siteSettingsSchema.safeParse({
        photoMaxMb: 0,
        photoBatchMax: 20,
        designMaxMb: 50,
        defaultQuotaGb: null,
      }).success,
    ).toBe(false);
    expect(
      siteSettingsSchema.safeParse({
        photoMaxMb: 20,
        photoBatchMax: 2.5,
        designMaxMb: 50,
        defaultQuotaGb: null,
      }).success,
    ).toBe(false);
    expect(
      siteSettingsSchema.safeParse({
        photoMaxMb: 20,
        photoBatchMax: 20,
        designMaxMb: 900,
        defaultQuotaGb: null,
      }).success,
    ).toBe(false);
  });
  it('업체 한도는 0.1GB 이상 또는 비움', () => {
    const id = '6f1b2c3d-1111-4a2b-8c3d-9e8f7a6b5c4d'; // zod uuid 는 RFC 형식(버전 자리)을 검사한다
    expect(companyQuotaSchema.safeParse({ companyId: id, quotaGb: '0.05' }).success).toBe(false);
    expect(companyQuotaSchema.safeParse({ companyId: id, quotaGb: '2' }).success).toBe(true);
    expect(companyQuotaSchema.safeParse({ companyId: id, quotaGb: null }).success).toBe(true);
  });
});

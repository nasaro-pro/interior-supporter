import { describe, expect, it } from 'vitest';
import { explainAdminDbError } from './db-errors';

describe('사이트 관리 DB 오류 문구', () => {
  it('알려진 사유는 코드와 화면 문구 키로', () => {
    expect(explainAdminDbError('sole_owner')).toEqual({
      code: 'CONFLICT',
      reasonKey: 'error.soleOwner',
    });
    expect(explainAdminDbError('not_member')?.reasonKey).toBe('error.notMember');
    expect(explainAdminDbError('not_found')).toEqual({ code: 'NOT_FOUND' });
  });
  it('모르는 문구·빈 값은 null', () => {
    expect(explainAdminDbError('forbidden')).toBeNull();
    expect(explainAdminDbError(undefined)).toBeNull();
    expect(explainAdminDbError('owner_role_locked')).toBeNull();
  });
});

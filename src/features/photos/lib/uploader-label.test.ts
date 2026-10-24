import { describe, expect, it } from 'vitest';
import { uploaderLabel } from './uploader-label';

const t = (key: string) =>
  ({ 'uploaderRole.staff': '업체', 'uploaderRole.field': '시공팀' })[key] ?? key;

describe('uploaderLabel', () => {
  it('이름을 볼 수 있으면 역할 · 이름', () => {
    expect(uploaderLabel(t, { uploaderRole: 'field', uploaderName: '시공1' })).toBe(
      '시공팀 · 시공1',
    );
  });
  it('프로필을 볼 수 없으면 역할만 (알 수 없는 사용자 대신)', () => {
    expect(uploaderLabel(t, { uploaderRole: 'staff', uploaderName: null })).toBe('업체');
  });
});

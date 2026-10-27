import { describe, expect, it } from 'vitest';
import { bytesToGb, bytesToMb, formatBytes, gbToBytes, mbToBytes, usagePercent } from './bytes';

describe('용량 변환 (A6)', () => {
  it('MB ↔ 바이트', () => {
    expect(mbToBytes(20)).toBe(20 * 1024 * 1024);
    expect(bytesToMb(20 * 1024 * 1024)).toBe(20);
    expect(bytesToMb(1.5 * 1024 * 1024)).toBe(1.5);
  });
  it('GB 빈 값은 null 그대로', () => {
    expect(gbToBytes(null)).toBeNull();
    expect(bytesToGb(null)).toBeNull();
    expect(bytesToGb(gbToBytes(2))).toBe(2);
  });
  it('사람이 읽는 표시', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe('3.0 GB');
  });
  it('사용 비율: 한도 없으면 null, 넘으면 100', () => {
    expect(usagePercent(10, null)).toBeNull();
    expect(usagePercent(50, 200)).toBe(25);
    expect(usagePercent(300, 200)).toBe(100);
  });
});

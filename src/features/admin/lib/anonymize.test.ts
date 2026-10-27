import { describe, expect, it } from 'vitest';
import { anonymizedEmail } from './anonymize';

describe('익명화 이메일 (A5·A10)', () => {
  it('사용자마다 다르고 원래 이메일을 담지 않는다', () => {
    const a = anonymizedEmail('a0000000-0000-0000-0000-000000000001');
    const b = anonymizedEmail('a0000000-0000-0000-0000-000000000002');
    expect(a).not.toBe(b);
    expect(a.endsWith('@anonymized.invalid')).toBe(true);
    expect(a).toContain('a0000000-0000-0000-0000-000000000001');
  });
});

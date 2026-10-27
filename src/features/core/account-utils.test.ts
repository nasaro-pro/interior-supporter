// D-10·D-12·D-15·D-16 계정 순수 함수 — 업체 주소 자동 생성·임시 비밀번호·첫 로그인 상태
import { describe, expect, it } from 'vitest';
import { RESERVED_SLUGS, SLUG_PATTERN } from '@/shared/contracts/domain';
import {
  firstLoginState,
  makeCompanySlug,
  makeTempPassword,
  TEMP_PASSWORD_HOURS,
  tempPasswordExpiry,
} from './account-utils';
import { changePasswordSchema, signupSchema } from './schema';

describe('D-10 makeCompanySlug', () => {
  it('이메일 앞부분 + 임의 4자, 항상 주소 규칙을 만족', () => {
    const s = makeCompanySlug('Bella.Park_01@example.com');
    expect(s).toMatch(/^bella-park-01-[a-z2-9]{4}$/);
    expect(SLUG_PATTERN.test(s)).toBe(true);
  });

  it('한글·특수문자만 있으면 studio-xxxx', () => {
    expect(makeCompanySlug('박예원@example.com')).toMatch(/^studio-[a-z2-9]{4}$/);
    expect(makeCompanySlug('___@example.com')).toMatch(/^studio-[a-z2-9]{4}$/);
  });

  it('예약어·너무 짧은 이름은 studio 로', () => {
    for (const r of RESERVED_SLUGS.slice(0, 5))
      expect(makeCompanySlug(`${r}@x.com`)).toMatch(/^studio-[a-z2-9]{4}$/);
    expect(makeCompanySlug('a@x.com')).toMatch(/^studio-/);
  });

  it('긴 이름은 잘라서 40자 이내', () => {
    const s = makeCompanySlug(`${'a'.repeat(80)}@x.com`);
    expect(s.length).toBeLessThanOrEqual(40);
    expect(SLUG_PATTERN.test(s)).toBe(true);
  });

  it('가입 입력에서 주소명은 받지 않는다 (보내도 무시)', () => {
    const parsed = signupSchema.safeParse({
      companyName: '한글 인테리어 Studio',
      slug: '!!잘못된 값!!',
      displayName: '박예원',
      email: 'bella@example.com',
      password: 'Sup3r-secret-pw',
      passwordConfirm: 'Sup3r-secret-pw',
      agree: 'on',
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && 'slug' in parsed.data).toBe(false);
  });
});

describe('D-12 makeTempPassword', () => {
  it('12자, 대문자·소문자·숫자 포함, 헷갈리는 글자 없음, 비밀번호 규칙 통과', () => {
    for (let i = 0; i < 200; i++) {
      const pw = makeTempPassword();
      expect(pw).toHaveLength(12);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[2-9]/);
      expect(pw).not.toMatch(/[01OIl]/);
      expect(
        changePasswordSchema.safeParse({ currentPassword: 'x', password: pw, passwordConfirm: pw })
          .success,
      ).toBe(true);
    }
  });

  it('매번 다르다', () => {
    expect(new Set(Array.from({ length: 50 }, () => makeTempPassword())).size).toBe(50);
  });
});

describe('D-15·D-16 firstLoginState', () => {
  const now = new Date('2026-10-24T00:00:00Z');
  it('표시 없음 → ready', () => {
    expect(firstLoginState(null, now)).toBe('ready');
    expect(
      firstLoginState({ must_change_password: false, temp_password_expires_at: null }, now),
    ).toBe('ready');
  });
  it('표시 있음 + 만료 전 → must_change, 만료 후 → expired', () => {
    expect(
      firstLoginState(
        { must_change_password: true, temp_password_expires_at: '2026-10-25T00:00:00Z' },
        now,
      ),
    ).toBe('must_change');
    expect(
      firstLoginState(
        { must_change_password: true, temp_password_expires_at: '2026-10-23T23:59:59Z' },
        now,
      ),
    ).toBe('expired');
  });
  it('임시 비밀번호는 72시간 유효', () => {
    expect(TEMP_PASSWORD_HOURS).toBe(72);
    expect(tempPasswordExpiry(now)).toBe('2026-10-27T00:00:00.000Z');
  });
});

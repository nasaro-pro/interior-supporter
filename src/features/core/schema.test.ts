// TC-001·TC-004·TC-011·TC-018 입력 검증 (DB CHECK 와 같은 길이·형식) — 정상·예외
import { describe, expect, it } from 'vitest';
import {
  passwordSchema,
  projectCreateSchema,
  projectInviteSchema,
  signupSchema,
  slugSchema,
} from './schema';
import { parseInput, toFieldErrors } from '@/shared/lib/action';

const uuid = '11111111-1111-4111-8111-111111111111';

describe('POL-034 비밀번호', () => {
  it('TC-001 10자 이상 정상 비밀번호는 통과한다', () => {
    expect(passwordSchema.safeParse('studio-2026!').success).toBe(true);
  });
  it('TC-001 짧은·흔한·반복 비밀번호는 거절한다', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false);
    expect(passwordSchema.safeParse('1234567890').success).toBe(false);
    expect(passwordSchema.safeParse('aaaaaaaaaaaa').success).toBe(false);
    expect(passwordSchema.safeParse('x'.repeat(73)).success).toBe(false);
  });
});

describe('TERM-002 업체 주소명(slug)', () => {
  it('TC-001 영소문자·숫자·하이픈 3~40자는 통과하고 소문자로 맞춘다', () => {
    expect(slugSchema.parse('Studio-Lime')).toBe('studio-lime');
  });
  it('TC-001 형식 오류·예약어는 필드 오류 키로 거절한다', () => {
    const bad = slugSchema.safeParse('-ab');
    expect(bad.success).toBe(false);
    if (!bad.success) expect(toFieldErrors(bad.error)._form).toEqual(['field.slugPattern']);
    const reserved = slugSchema.safeParse('admin');
    expect(reserved.success).toBe(false);
    if (!reserved.success)
      expect(toFieldErrors(reserved.error)._form).toEqual(['field.slugReserved']);
  });
});

describe('REQ-001 업체 가입 입력', () => {
  const base = {
    companyName: '스튜디오 라임',
    slug: 'studio-lime',
    displayName: '김소유',
    email: 'Owner@Example.com',
    password: 'studio-2026!',
    passwordConfirm: 'studio-2026!',
    agree: 'on',
  };
  it('TC-001 정상 입력은 통과하고 이메일을 소문자로 맞춘다', () => {
    const r = parseInput(signupSchema, base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.email).toBe('owner@example.com');
  });
  it('TC-001 약관 미동의·비밀번호 불일치는 VALIDATION_FAILED + 필드 오류', () => {
    const r = parseInput(signupSchema, { ...base, agree: '', passwordConfirm: 'different-123' });
    expect(r.ok).toBe(false);
    if (!r.ok && !r.result.ok) {
      expect(r.result.error.code).toBe('VALIDATION_FAILED');
      expect(r.result.error.fieldErrors?.agree).toEqual(['field.required']);
      expect(r.result.error.fieldErrors?.passwordConfirm).toEqual(['field.passwordMismatch']);
    }
  });
});

describe('REQ-011 프로젝트 생성 입력', () => {
  it('TC-011 종료일이 시작일보다 빠르면 거절한다', () => {
    const r = projectCreateSchema.safeParse({
      id: uuid,
      name: '반포 32평',
      siteAddress: '',
      startDate: '2026-10-10',
      endDate: '2026-10-01',
      status: 'planned',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(toFieldErrors(r.error).endDate).toEqual(['field.dateOrder']);
  });
  it('TC-011 빈 날짜는 null 로 바꾼다', () => {
    const r = projectCreateSchema.parse({
      id: uuid,
      name: '반포 32평',
      siteAddress: '',
      startDate: '',
      endDate: '',
      status: 'active',
    });
    expect(r.startDate).toBeNull();
    expect(r.endDate).toBeNull();
  });
  it('TC-011 이름 120자 초과는 tooLong|120', () => {
    const r = projectCreateSchema.safeParse({
      id: uuid,
      name: 'x'.repeat(121),
      siteAddress: '',
      status: 'planned',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(toFieldErrors(r.error).name).toEqual(['field.tooLong|120']);
  });
});

describe('REQ-003 초대 입력', () => {
  it('TC-003 확정권은 고객 초대에만 허용한다 (시공팀 + 확정권 → 거절)', () => {
    const r = projectInviteSchema.safeParse({
      projectId: uuid,
      email: 'f1@example.com',
      role: 'field',
      canConfirm: 'on',
      validFrom: '',
      validUntil: '',
    });
    expect(r.success).toBe(false);
  });
  it('TC-018 기간 역전은 거절한다', () => {
    const r = projectInviteSchema.safeParse({
      projectId: uuid,
      email: 'u1@example.com',
      role: 'customer',
      validFrom: '2026-10-10',
      validUntil: '2026-10-09',
    });
    expect(r.success).toBe(false);
  });
});

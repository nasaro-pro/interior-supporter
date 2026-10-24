// src/features/core/schema.ts (A) — zod 스키마. 길이는 마이그레이션 CHECK 와 같다 (20261006000100_a_foundation.sql)
// 메시지는 errors.json 의 field.* 키. 인자가 필요한 키는 'field.tooLong|120' 처럼 | 뒤에 값을 붙인다 (FieldError 가 해석).
import { z } from 'zod';
import {
  HOME_SECTION_KEYS,
  MEMBER_ROLES,
  PASSWORD_RULE,
  PROJECT_STATUSES,
  RESERVED_SLUGS,
  SLUG_PATTERN,
} from '@/shared/contracts/domain';
import { HOME_THEMES } from './home-theme';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

const text = (max: number, min = 0) => {
  let s = z
    .string()
    .trim()
    .max(max, { message: `field.tooLong|${max}` });
  if (min > 0) s = s.min(min, { message: min === 1 ? 'field.required' : `field.tooShort|${min}` });
  return s;
};

/** 빈 문자열 → null 인 선택 날짜 */
const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .refine((v) => v === null || YMD.test(v), { message: 'field.invalid' })
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const checkbox = z
  .union([z.literal('on'), z.literal('true'), z.literal('false'), z.literal(''), z.boolean()])
  .optional()
  .transform((v) => v === 'on' || v === 'true' || v === true);

const uuid = z.string().uuid({ message: 'field.invalid' });
const version = z.coerce.number().int().min(1);

/** POL-034: 10~72자, 흔한 비밀번호·한 글자 반복 거절 */
const COMMON_PASSWORDS = new Set([
  '1234567890',
  '12345678910',
  '0123456789',
  'qwertyuiop',
  'qwerty1234',
  'password12',
  'password123',
  'password1234',
  'passw0rd123',
  'asdfghjkl1',
  'iloveyou12',
  '1q2w3e4r5t',
  '1q2w3e4r!@',
  'q1w2e3r4t5',
  'abcd123456',
  'abcdefghij',
  'admin12345',
  'welcome123',
  'letmein123',
  'a123456789',
  'zxcvbnm123',
]);

export const passwordSchema = z
  .string()
  .min(PASSWORD_RULE.min, { message: 'field.passwordLength' })
  .max(PASSWORD_RULE.max, { message: 'field.passwordLength' })
  .refine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()), { message: 'field.passwordCommon' })
  .refine((v) => new Set(v).size > 1, { message: 'field.passwordRepeat' });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, { message: 'field.tooLong|254' })
  .email({ message: 'field.email' });

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(SLUG_PATTERN, { message: 'field.slugPattern' })
  .refine((v) => !(RESERVED_SLUGS as readonly string[]).includes(v), {
    message: 'field.slugReserved',
  });

// ── 인증 ───────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: 'field.required' }).max(PASSWORD_RULE.max),
  next: z.string().optional(),
});

export const signupSchema = z
  .object({
    companyName: text(100, 1),
    slug: slugSchema,
    displayName: text(80, 1),
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
    agree: checkbox.refine((v) => v, { message: 'field.required' }),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: 'field.passwordMismatch',
    path: ['passwordConfirm'],
  });

export const newPasswordSchema = z
  .object({ password: passwordSchema, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, {
    message: 'field.passwordMismatch',
    path: ['passwordConfirm'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: 'field.required' }),
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: 'field.passwordMismatch',
    path: ['passwordConfirm'],
  });

export const acceptNewAccountSchema = z
  .object({
    token: z.string().min(16).max(128),
    displayName: text(80, 1),
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: 'field.passwordMismatch',
    path: ['passwordConfirm'],
  });

export const localeSchema = z.object({ locale: z.enum(['ko', 'en']) });

// ── 프로젝트 ───────────────────────────────────────────────────────
const dateOrder = <T extends { startDate: string | null; endDate: string | null }>(v: T) =>
  !v.startDate || !v.endDate || v.endDate >= v.startDate;

export const projectCreateSchema = z
  .object({
    id: uuid, // POL-038: 폼을 열 때 만든 id
    name: text(120, 1),
    siteAddress: text(200),
    startDate: optionalDate,
    endDate: optionalDate,
    status: z.enum(PROJECT_STATUSES, { message: 'field.select' }),
  })
  .refine(dateOrder, { message: 'field.dateOrder', path: ['endDate'] });

export const projectUpdateSchema = z
  .object({
    projectId: uuid,
    baseVersion: version,
    name: text(120, 1),
    siteAddress: text(200),
    startDate: optionalDate,
    endDate: optionalDate,
    status: z.enum(PROJECT_STATUSES, { message: 'field.select' }),
    currentPhase: text(60),
    isPublic: checkbox,
  })
  .refine(dateOrder, { message: 'field.dateOrder', path: ['endDate'] });

export const homeSectionsSchema = z
  .array(z.object({ key: z.enum(HOME_SECTION_KEYS), visible: z.boolean() }))
  .length(4)
  .refine((v) => new Set(v.map((s) => s.key)).size === 4, { message: 'field.invalid' });

export const homeUpdateSchema = z.object({
  projectId: uuid,
  baseVersion: version,
  homeMessage: z.string().max(2000, { message: 'field.tooLong|2000' }),
  homeSections: homeSectionsSchema,
  homeTheme: z.enum(HOME_THEMES, { message: 'field.select' }),
  /** 커버는 템플릿에서 복사된 것만 — 프로젝트 화면에서는 유지(id) 또는 제거(null)만 */
  homeCoverFileId: uuid.nullable(),
});

export const projectArchiveSchema = z.object({
  projectId: uuid,
  baseVersion: version,
  archive: z.boolean(),
});

// ── 참여자·초대 (REQ-003, REQ-018) ─────────────────────────────────
const periodRefine = <T extends { validFrom: string | null; validUntil: string | null }>(v: T) =>
  !v.validFrom || !v.validUntil || v.validUntil >= v.validFrom;

export const projectInviteSchema = z
  .object({
    projectId: uuid,
    email: emailSchema,
    role: z.enum(['customer', 'field'], { message: 'field.select' }),
    canConfirm: checkbox,
    validFrom: optionalDate,
    validUntil: optionalDate,
  })
  .refine(periodRefine, { message: 'field.dateOrder', path: ['validUntil'] })
  .refine((v) => !v.canConfirm || v.role === 'customer', {
    message: 'field.invalid',
    path: ['canConfirm'],
  });

export const assignPmSchema = z.object({ projectId: uuid, userId: uuid });

export const participantUpdateSchema = z
  .object({
    projectId: uuid,
    participantId: uuid,
    baseVersion: version,
    validFrom: optionalDate,
    validUntil: optionalDate,
    canConfirm: checkbox,
  })
  .refine(periodRefine, { message: 'field.dateOrder', path: ['validUntil'] });

export const participantRevokeSchema = z.object({
  projectId: uuid,
  participantId: uuid,
  baseVersion: version,
});

export const inviteRevokeSchema = z.object({ inviteId: uuid, projectId: uuid.nullable() });

// ── 고객 카드 (REQ-020·021) ────────────────────────────────────────
export const clientCreateSchema = z.object({
  id: uuid,
  name: text(80, 1),
  phone: text(30),
  email: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v.toLowerCase()))
    .refine((v) => v === null || z.string().email().safeParse(v).success, {
      message: 'field.email',
    }),
  memo: z.string().max(2000, { message: 'field.tooLong|2000' }),
});

export const clientUpdateSchema = clientCreateSchema.extend({ baseVersion: version });

export const clientLinkSchema = z.object({ clientId: uuid, projectId: uuid });
/** DB-08 연결 해제 */
export const clientUnlinkSchema = clientLinkSchema;

export const clientArchiveSchema = z.object({
  clientId: uuid,
  baseVersion: version,
  archive: z.boolean(),
});

// ── 업체 설정 (REQ-050~053) ────────────────────────────────────────
export const companyUpdateSchema = z.object({
  companyId: uuid,
  baseVersion: version,
  name: text(100, 1),
});

export const companyLogoSchema = z.object({
  companyId: uuid,
  baseVersion: version,
  fileId: uuid,
});

export const templateUpdateSchema = z.object({
  companyId: uuid,
  baseVersion: version,
  defaultHomeMessage: z.string().max(2000, { message: 'field.tooLong|2000' }),
  defaultHomeSections: homeSectionsSchema,
  defaultHomeTheme: z.enum(HOME_THEMES, { message: 'field.select' }),
  defaultHomeCoverFileId: uuid.nullable(),
});

export const memberInviteSchema = z.object({
  companyId: uuid,
  email: emailSchema,
  role: z.enum(['pm', 'manager'], { message: 'field.select' }),
});

export const memberRoleSchema = z.object({
  companyId: uuid,
  memberId: uuid,
  baseVersion: version,
  role: z.enum(MEMBER_ROLES).refine((r) => r !== 'owner', { message: 'field.invalid' }),
});

export const memberRemoveSchema = z.object({
  companyId: uuid,
  memberId: uuid,
  baseVersion: version,
});

export const resetLinkSchema = z.object({ companyId: uuid, targetUserId: uuid });

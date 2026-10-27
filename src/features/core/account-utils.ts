// src/features/core/account-utils.ts (A · D-10·D-12) — 계정 관련 순수 함수 (서버·테스트 공용)
import { randomInt } from 'node:crypto';
import { RESERVED_SLUGS, SLUG_PATTERN } from '@/shared/contracts/domain';

const SLUG_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

function randomSuffix(len: number, rnd: (max: number) => number = randomInt): string {
  let out = '';
  for (let i = 0; i < len; i++) out += SLUG_ALPHABET[rnd(SLUG_ALPHABET.length)];
  return out;
}

/**
 * D-10: 가입 이메일 앞부분으로 업체 주소(slug)를 만든다 — 사용자는 주소를 입력하지 않는다.
 * 영문 소문자·숫자·하이픈만 남기고, 쓸 수 없으면 'studio'. 뒤에 임의 4자를 붙여 겹침을 줄인다.
 * 결과는 항상 SLUG_PATTERN(3~40자)을 만족한다.
 */
export function makeCompanySlug(email: string, rnd?: (max: number) => number): string {
  const local = (email.split('@')[0] ?? '').toLowerCase();
  let base = local
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/g, '');
  if (base.length < 2 || (RESERVED_SLUGS as readonly string[]).includes(base)) base = 'studio';
  const slug = `${base}-${randomSuffix(4, rnd)}`;
  return SLUG_PATTERN.test(slug) ? slug : `studio-${randomSuffix(4, rnd)}`;
}

const PW_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PW_LOWER = 'abcdefghijkmnopqrstuvwxyz';
const PW_DIGIT = '23456789';
const PW_ALL = PW_UPPER + PW_LOWER + PW_DIGIT;

/**
 * D-12: 임시 비밀번호 12자 — 헷갈리는 글자(0·O·1·l·I) 제외, 대문자·소문자·숫자 각 1자 이상.
 * 비밀번호 규칙(POL-034, 10~72자)을 항상 만족한다.
 */
export function makeTempPassword(rnd: (max: number) => number = randomInt): string {
  const pick = (set: string) => set[rnd(set.length)] ?? set[0]!;
  const chars = [pick(PW_UPPER), pick(PW_LOWER), pick(PW_DIGIT)];
  while (chars.length < 12) chars.push(pick(PW_ALL));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}

/** 임시 비밀번호 유효 시간 (D-16) */
export const TEMP_PASSWORD_HOURS = 72;

export function tempPasswordExpiry(now = new Date()): string {
  return new Date(now.getTime() + TEMP_PASSWORD_HOURS * 60 * 60 * 1000).toISOString();
}

/** 첫 로그인 상태 판정 (D-15·D-16) */
export function firstLoginState(
  profile: { must_change_password: boolean; temp_password_expires_at: string | null } | null,
  now = new Date(),
): 'ready' | 'must_change' | 'expired' {
  if (!profile?.must_change_password) return 'ready';
  if (profile.temp_password_expires_at && new Date(profile.temp_password_expires_at) <= now)
    return 'expired';
  return 'must_change';
}

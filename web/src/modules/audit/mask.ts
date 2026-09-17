/**
 * ARCHITECTURE.md 12.1 — before/after 에 개인정보 원문을 넣지 않는다.
 *
 * 키 이름 **부분 일치**로 판정한다. 완전 일치(`^phone$` 형태)로 두면
 * customerPhone · contactEmail · siteAddress 처럼 접두·접미가 붙은 키를 놓친다.
 */
const PII_KEY =
  /(phone|mobile|tel|email|mail|address|addr|zipcode|postcode|birth|ssn|rrn|account|card|연락처|주소|전화|이메일)/i;

const MASK = "[redacted]";

export function maskPii(value: unknown, depth = 0): unknown {
  if (depth > 6) return MASK; // 순환·과도한 중첩 방어
  if (Array.isArray(value)) return value.map((v) => maskPii(v, depth + 1));
  if (value && typeof value === "object") {
    if (value instanceof Date) return value.toISOString();
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        PII_KEY.test(key) ? MASK : maskPii(nested, depth + 1),
      ]),
    );
  }
  return value;
}

// src/shared/lib/money.ts (A · 스타터 고정) — 금액 표시 (KRW 정수, POL-015·D12). toLocaleString 을 직접 쓰지 않는다.
export type MoneyLocale = 'ko' | 'en';

const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** ko '45,000원' / en '₩45,000' */
export function formatWon(amount: number, locale: MoneyLocale): string {
  if (!Number.isInteger(amount)) throw new Error(`금액은 원 단위 정수입니다: ${amount}`);
  const n = grouped.format(amount);
  return locale === 'ko' ? `${n}원` : `₩${n}`;
}

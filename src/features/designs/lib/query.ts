// (P3: kit/query.ts 에서 이동 — UI 아님) routes.ts 로 만든 정규 경로에 목록 상태(query)를 붙인다 — 필터·보관함·더 보기는 새 뎁스가 아니다 (02 문서 4장)
import { PAGE_SIZE } from '@/shared/contracts/domain';

export function withQuery(
  base: string,
  params: Record<string, string | number | undefined | null>,
) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  }
  const qs = s.toString();
  return qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base;
}

/** ?limit= (30 단위 '더 보기'). 잘못된 값은 기본 30, 최대 300 */
export function parseLimit(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isInteger(n) || n < PAGE_SIZE) return PAGE_SIZE;
  return Math.min(n - (n % PAGE_SIZE), PAGE_SIZE * 10);
}

export function one(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

// 요청 목록 query 해석 — 필터 상태는 query 로 표현한다 (02 문서 4장). 순수 함수.
import { PAGE_SIZE, REQUEST_STATUSES, type RequestStatus } from '@/shared/contracts/domain';
import type { ProjectAccess } from '@/shared/contracts/integration';
import type { RequestListFilters } from '../types';

export type SearchParams = Record<string, string | string[] | undefined>;

export const MAX_LIST_SIZE = PAGE_SIZE * 10;

export function firstParam(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

/** '더 보기' 누적 개수: 30 단위, 30~300 */
export function parseListSize(value: string | undefined): number {
  const n = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(n) || n < PAGE_SIZE) return PAGE_SIZE;
  return Math.min(MAX_LIST_SIZE, Math.floor(n / PAGE_SIZE) * PAGE_SIZE);
}

export function parseRequestListParams(
  sp: SearchParams,
  as: ProjectAccess['as'],
): RequestListFilters {
  const q = (firstParam(sp, 'q') ?? '').trim().slice(0, 100);
  const s = firstParam(sp, 'status');
  const status = (REQUEST_STATUSES as readonly string[]).includes(s ?? '')
    ? (s as RequestStatus)
    : null;
  // POL-020: 보관함은 편집자만
  const archived = as === 'editor' && firstParam(sp, 'archived') === '1';
  return { q, status, archived, size: parseListSize(firstParam(sp, 'size')) };
}

/** 현재 필터에 patch 를 덮어쓴 목록 주소 (base 는 routes 로 만든 경로) */
export function requestListHref(
  base: string,
  current: RequestListFilters,
  patch: Partial<RequestListFilters>,
): string {
  const f = { ...current, ...patch };
  const s = new URLSearchParams();
  if (f.q) s.set('q', f.q);
  if (f.status) s.set('status', f.status);
  if (f.archived) s.set('archived', '1');
  if (f.size !== PAGE_SIZE) s.set('size', String(f.size));
  const qs = s.toString();
  return qs ? `${base}?${qs}` : base;
}

/** routes 로 만든 경로에 화면 상태 query 를 붙인다 (예: ?mode=new — 새 뎁스 아님) */
export function withQuery(base: string, params: Record<string, string | null | undefined>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) s.set(k, v);
  const qs = s.toString();
  return qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base;
}

/** ilike 패턴 특수 문자 이스케이프 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 경로 파라미터 형식 검사 — 형식이 틀리면 조회 전에 notFound (존재 숨김) */
export const isUuid = (value: string | null | undefined): value is string =>
  typeof value === 'string' && UUID.test(value);

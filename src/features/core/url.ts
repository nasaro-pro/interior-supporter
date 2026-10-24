// src/features/core/url.ts (A) — routes.ts 로 만든 경로에 쿼리(필터·커서·화면 상태)만 덧붙인다. 경로 자체는 routes 로만
export function withQuery(href: string, params: Record<string, string | undefined | null>): string {
  const [path, existing] = href.split('?');
  const qs = new URLSearchParams(existing ?? '');
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') qs.delete(k);
    else qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : (path ?? href);
}

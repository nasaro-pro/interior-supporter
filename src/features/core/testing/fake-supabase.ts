// src/features/core/testing/fake-supabase.ts (A · 테스트 전용) — 체인형 Supabase 쿼리 빌더 대역
// from()/rpc() 호출과 체인 메서드(eq·in·is·update·select·limit…)를 기록하고, 응답은 테스트가 정한다.
// 실제 DB 보호(RLS)는 pgTAP 이 검사한다. 여기서는 "앱이 어떤 조건으로 묻는가"(이중 검증)를 확인한다.

export type Call = [method: string, ...args: unknown[]];

export interface Query {
  /** 테이블 이름 또는 'rpc:<함수명>' */
  table: string;
  calls: Call[];
}

export interface FakeResult {
  data?: unknown;
  error?: { code?: string; message?: string; status?: number } | null;
  count?: number | null;
}

export type Responder = (q: Query) => FakeResult | undefined;

/** q 에 method(args…) 호출이 있었는가 (args 는 앞에서부터 일치) */
export function called(q: Query, method: string, ...args: unknown[]): boolean {
  return q.calls.some(
    ([m, ...a]) => m === method && args.every((v, i) => JSON.stringify(a[i]) === JSON.stringify(v)),
  );
}

export function callOf(q: Query, method: string): Call | undefined {
  return q.calls.find(([m]) => m === method);
}

export function createFakeSupabase(respond: Responder, auth: Record<string, unknown> = {}) {
  const queries: Query[] = [];

  const build = (q: Query): unknown => {
    queries.push(q);
    const proxy: unknown = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then') {
            const r = respond(q) ?? {};
            const value = { data: r.data ?? null, error: r.error ?? null, count: r.count ?? null };
            return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
              Promise.resolve(value).then(res, rej);
          }
          return (...args: unknown[]) => {
            q.calls.push([String(prop), ...args]);
            return proxy;
          };
        },
      },
    );
    return proxy;
  };

  const client = {
    from: (table: string) => build({ table, calls: [] }),
    rpc: (name: string, args?: unknown) => build({ table: `rpc:${name}`, calls: [['args', args]] }),
    auth,
  };

  return {
    client,
    queries,
    /** 테이블별 쿼리 목록 */
    of: (table: string) => queries.filter((q) => q.table === table),
  };
}

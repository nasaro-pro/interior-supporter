// Vitest 전용 — 앱 코드에서 import 하지 않는다. B 기능(files·designs·materials·estimates) 서버 테스트 공용
// 체이닝 가짜 Supabase 클라이언트: from().select().eq()… 의 op 를 기록하고, await/maybeSingle/single 시 결과를 꺼낸다.
import { vi } from 'vitest';

export type FakeError = { code?: string; message?: string } | null;
export type FakeResult = { data?: unknown; error?: FakeError };
export interface FakeOp {
  op: string;
  args: unknown[];
}
export interface FakeCall {
  table: string;
  ops: FakeOp[];
}
/** 결과를 호출 내용(ops)에 따라 만들고 싶을 때 (상태를 가진 가짜 테이블 등) */
export type FakeHandler = (call: FakeCall) => FakeResult | Promise<FakeResult>;
export type FakeScript = Record<string, FakeResult[] | FakeHandler>;

const CHAIN_OPS = [
  'select',
  'insert',
  'update',
  'upsert',
  'eq',
  'neq',
  'in',
  'is',
  'not',
  'or',
  'lt',
  'lte',
  'gt',
  'gte',
  'ilike',
  'order',
  'limit',
  'range',
  'filter',
  'match',
] as const;

export function createSupabaseFake(
  script: FakeScript,
  opts: { user?: { id: string } | null } = {},
) {
  const calls: FakeCall[] = [];
  const take = async (call: FakeCall): Promise<FakeResult> => {
    const entry = script[call.table];
    if (typeof entry === 'function') return entry(call);
    if (!entry || entry.length === 0) {
      throw new Error(`fake: ${call.table} 에 준비된 결과가 없습니다`);
    }
    return entry.shift()!;
  };
  const from = (table: string) => {
    const call: FakeCall = { table, ops: [] };
    calls.push(call);
    const settle = async () => ({ data: null, error: null, ...(await take(call)) });
    const builder: Record<string, unknown> = {};
    for (const op of CHAIN_OPS) {
      builder[op] = (...args: unknown[]) => {
        call.ops.push({ op, args });
        return builder;
      };
    }
    builder.maybeSingle = () => {
      call.ops.push({ op: 'maybeSingle', args: [] });
      return settle();
    };
    builder.single = () => {
      call.ops.push({ op: 'single', args: [] });
      return settle();
    };
    builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      settle().then(resolve, reject);
    return builder;
  };
  const rpc = (fn: string, args?: unknown) => {
    const builder = from(`rpc:${fn}`);
    calls[calls.length - 1]!.ops.push({ op: 'rpc', args: [args] });
    return builder;
  };
  const user = opts.user === undefined ? { id: 'u1' } : opts.user;
  const auth = {
    getUser: vi.fn(async () => ({ data: { user }, error: null })),
  };
  const ok = async () => ({ data: null, error: null });
  const storageApi = {
    download: vi.fn<(path: string) => Promise<{ data: unknown; error: FakeError }>>(ok),
    upload: vi.fn<
      (path: string, body: unknown, o?: unknown) => Promise<{ data: unknown; error: FakeError }>
    >(async () => ({ data: {}, error: null })),
    remove: vi.fn<(paths: string[]) => Promise<{ data: unknown; error: FakeError }>>(ok),
    createSignedUrl: vi.fn<
      (path: string, ttl: number, o?: unknown) => Promise<{ data: unknown; error: FakeError }>
    >(async () => ({ data: { signedUrl: 'https://storage.test/signed' }, error: null })),
  };
  const storage = { from: vi.fn(() => storageApi) };
  const client = { from: vi.fn(from), rpc: vi.fn(rpc), auth, storage };

  const callsOf = (table: string) => calls.filter((c) => c.table === table);
  const opsOf = (table: string, index = 0) => callsOf(table)[index]?.ops ?? [];
  const argOf = (table: string, op: string, index = 0) =>
    opsOf(table, index).find((o) => o.op === op)?.args;
  /** 해당 호출에 (op, ...args) 가 있었는지 */
  const hasOp = (table: string, op: string, args: unknown[], index = 0) =>
    opsOf(table, index).some((o) => o.op === op && JSON.stringify(o.args) === JSON.stringify(args));
  return { client, calls, callsOf, opsOf, argOf, hasOp, storageApi, auth };
}

/** next/navigation notFound() 흉내 — 테스트에서 throw 로 확인 */
export class NotFoundSignal extends Error {
  constructor() {
    super('NEXT_NOT_FOUND');
  }
}

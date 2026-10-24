// Vitest 전용 — 앱 코드에서 import 하지 않는다. C 기능(requests·photos·schedule) 테스트 공용
import { vi } from 'vitest';

export type FakeResult = {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
  count?: number | null;
};
export interface FakeCall {
  table: string;
  ops: { op: string; args: unknown[] }[];
}

const CHAIN_OPS = [
  'select',
  'insert',
  'update',
  'upsert',
  'eq',
  'neq',
  'in',
  'is',
  'lte',
  'gte',
  'lt',
  'gt',
  'or',
  'ilike',
  'order',
  'limit',
  'range',
  'not',
  'filter',
  'match',
  'contains',
] as const;

/**
 * 테이블별로 준비한 결과를 호출 순서대로 돌려주는 체이닝 가짜 Supabase 클라이언트.
 * await · maybeSingle() · single() 때 그 테이블의 다음 결과를 꺼낸다.
 */
export function createSupabaseFake(script: Record<string, FakeResult[]>) {
  const calls: FakeCall[] = [];
  const from = (table: string) => {
    const call: FakeCall = { table, ops: [] };
    calls.push(call);
    const take = (): FakeResult => {
      const queue = script[table];
      if (!queue || queue.length === 0) throw new Error(`fake: ${table} 에 준비된 결과가 없습니다`);
      return queue.shift()!;
    };
    const settle = () => Promise.resolve({ data: null, error: null, ...take() });
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
  /** rpc(fn, args) 는 'rpc:fn' 이름의 테이블처럼 결과를 꺼낸다 (args 는 op 'rpc' 로 기록) */
  const rpc = (fn: string, args?: unknown) => {
    const builder = from(`rpc:${fn}`) as Record<string, unknown>;
    calls[calls.length - 1]!.ops.push({ op: 'rpc', args: [args] });
    return builder;
  };
  const client = { from: vi.fn(from), rpc: vi.fn(rpc) };
  /** 특정 테이블 호출에서 op 인자 찾기 */
  const opsOf = (table: string, index = 0) =>
    calls.filter((c) => c.table === table)[index]?.ops ?? [];
  const argOf = (table: string, op: string, index = 0) =>
    opsOf(table, index).find((o) => o.op === op)?.args;
  return { client, calls, opsOf, argOf };
}

/** next/navigation notFound() 흉내 — 테스트에서 throw 로 확인 */
export class NotFoundSignal extends Error {
  constructor() {
    super('NEXT_NOT_FOUND');
  }
}

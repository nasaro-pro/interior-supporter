import { sql } from "drizzle-orm";
import { db, type DbTx } from "@/lib/db/client";
import type { DataContext } from "@/lib/tenancy/context";

/**
 * ARCHITECTURE.md 6.6 — 트랜잭션 안에서만 SET LOCAL 이 유효하다.
 * 테이블 소유자 역할은 FORCE 전까지 RLS 를 우회하므로, 앱 격리는 계속
 * DataContext 가 담당하고 정책은 파일럿 전 방어선으로 둔다.
 */
export async function applyRls(ctx: DataContext, tx: DbTx) {
  if (ctx.kind === "platform" || ctx.kind === "system") {
    await tx.execute(sql`select set_config('app.bypass_rls', 'on', true)`);
    return;
  }
  await tx.execute(sql`select set_config('app.bypass_rls', 'off', true)`);
  await tx.execute(
    sql`select set_config('app.company_id', ${ctx.companyId}, true)`,
  );
}

export async function tenantTransaction<T>(
  ctx: DataContext,
  fn: (tx: DbTx) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    await applyRls(ctx, tx);
    return fn(tx);
  });
}

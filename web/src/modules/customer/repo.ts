import { and, desc, eq, isNull } from "drizzle-orm";
import { db, type DbTx } from "@/lib/db/client";
import { cursorCondition, cursorTs, decodeCursor, paginate } from "@/lib/cursor";
import { customers } from "@/modules/customer/schema";
import { assertSameTenant, scoped, type DataContext } from "@/lib/tenancy/context";

type Executor = typeof db | DbTx;

export async function listCustomers(
  ctx: DataContext,
  filter: { cursor?: string; limit?: number } = {},
) {
  const limit = filter.limit ?? 20;
  const rows = await db
    .select({ row: customers, cursorTs: cursorTs(customers.createdAt) })
    .from(customers)
    .where(
      and(
        scoped(ctx, customers),
        isNull(customers.deletedAt),
        cursorCondition(customers.createdAt, customers.id, decodeCursor(filter.cursor)),
      ),
    )
    .orderBy(desc(customers.createdAt), desc(customers.id))
    .limit(limit + 1);
  for (const row of rows) assertSameTenant(ctx, row.row);
  const page = paginate(rows, limit, (row) => ({
    createdAtRaw: row.cursorTs,
    id: row.row.id,
  }));
  return { items: page.items.map((r) => r.row), nextCursor: page.nextCursor };
}

export async function findCustomerById(
  ctx: DataContext,
  customerId: string,
  tx: Executor = db,
) {
  const [row] = await tx
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.id, customerId),
        scoped(ctx, customers),
        isNull(customers.deletedAt),
      ),
    )
    .limit(1);
  if (row) assertSameTenant(ctx, row);
  return row ?? null;
}

export async function insertCustomer(
  ctx: DataContext,
  values: typeof customers.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(customers).values(values).returning();
  if (!row) throw new Error("고객 생성에 실패했습니다.");
  assertSameTenant(ctx, row);
  return row;
}

export async function updateCustomerRow(
  ctx: DataContext,
  customerId: string,
  patch: Partial<typeof customers.$inferInsert>,
  tx: Executor = db,
) {
  const [row] = await tx
    .update(customers)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(customers.id, customerId), scoped(ctx, customers)))
    .returning();
  if (row) assertSameTenant(ctx, row);
  return row ?? null;
}

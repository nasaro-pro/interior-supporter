import { db, type DbTx } from "@/lib/db/client";
import { subscriptions } from "@/modules/billing/schema";
import { assertSameTenant, type DataContext } from "@/lib/tenancy/context";

export async function insertFreeSubscription(
  ctx: DataContext,
  companyId: string,
  tx: typeof db | DbTx = db,
) {
  const [row] = await tx
    .insert(subscriptions)
    .values({
      companyId,
      planTier: "free",
      status: "active",
    })
    .returning();
  if (!row) throw new Error("구독 레코드 생성에 실패했습니다.");
  assertSameTenant(ctx, row);
  return row;
}

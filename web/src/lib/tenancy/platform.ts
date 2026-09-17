import { recordAudit } from "@/modules/audit";
import type { DataContext } from "@/lib/tenancy/context";

export async function createPlatformContext(
  userId: string,
  reason: string,
): Promise<DataContext> {
  if (!reason.trim()) throw new Error("platform 컨텍스트는 사유가 필요합니다.");
  const ctx: DataContext = { kind: "platform", userId, reason };
  await recordAudit(
    { action: "cross_tenant_query", targetType: "platform", targetId: userId },
    ctx,
  );
  return ctx;
}

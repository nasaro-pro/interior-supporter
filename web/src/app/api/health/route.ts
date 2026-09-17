import { requirePublicHealth } from "@/lib/authz";
import { getPlatformSetting } from "@/modules/company";
import { getStorageAdapter } from "@/lib/storage";
import { messages } from "@/lib/messages";

export async function GET() {
  await requirePublicHealth();
  await getPlatformSetting("plan_enforcement_enabled");
  await getStorageAdapter().head("_health");
  return Response.json({ ok: true, status: messages.healthOk });
}

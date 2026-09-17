import { requirePlatformAdmin } from "@/lib/authz";
import { messages } from "@/lib/messages";

export default async function Page() {
  await requirePlatformAdmin("결제 현황 조회");
  return (
    <main className="p-6">
      <h1 className="text-3xl">{messages.billingTitle}</h1>
      <p className="mt-4 text-sm">{messages.billingIdle}</p>
    </main>
  );
}

import { requireCompanyAdmin } from "@/lib/authz";
import { findCompanyBySlug } from "@/modules/company";
import { messages } from "@/lib/messages";

export default async function Page({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const ctx = await requireCompanyAdmin(companySlug);
  const company = await findCompanyBySlug(ctx, companySlug);
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-3xl">{messages.storageTitle}</h1>
      <p>
        {messages.storageUsed}: {company?.storageUsedMb ?? 0} MB
      </p>
      <p>
        {messages.storageQuota}: {company?.storageQuotaMb ?? 0} MB
      </p>
    </main>
  );
}

import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/authz";
import { listCompanies } from "@/modules/company";
import { formatSeoul } from "@/lib/datetime";
import { messages, planTierLabels } from "@/lib/messages";
import { CreateCompanyForm } from "./create-form";

const statusLabel = {
  active: messages.companyStatusActive,
  past_due: messages.companyStatusPastDue,
  suspended: messages.companyStatusSuspended,
} as const;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const q = await searchParams;
  const ctx = await requirePlatformAdmin("업체 목록 조회");
  const result = await listCompanies(ctx, { cursor: q.cursor, limit: 20 });
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div>
        <p className="gold-label">{messages.platformTitle}</p>
        <h1 className="mt-2 text-3xl">{messages.companiesTitle}</h1>
      </div>
      <CreateCompanyForm />
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">{messages.companyNameLabel}</th>
            <th>{messages.memberStatus}</th>
            <th>{messages.pricingTitle}</th>
            <th>{messages.storageTitle}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {result.items.map((row) => (
            <tr key={row.id} className="border-t">
              <td className="py-2">
                <Link className="text-link" href={`/platform/companies/${row.id}`}>
                  {row.name}
                </Link>
              </td>
              <td>{statusLabel[row.status]}</td>
              <td>{planTierLabels[row.planTier]}</td>
              <td>{row.storageUsedMb}MB</td>
              <td>{formatSeoul(row.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {result.nextCursor ? (
        <a className="ghost-btn w-fit" href={`/platform/companies?cursor=${encodeURIComponent(result.nextCursor)}`}>
          {messages.nextPage}
        </a>
      ) : null}
    </main>
  );
}

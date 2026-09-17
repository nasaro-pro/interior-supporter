import Link from "next/link";
import { requireCompanyStaff } from "@/lib/authz";
import { listMyAssignments } from "@/modules/assignment";
import { formatSeoul } from "@/lib/datetime";
import { messages } from "@/lib/messages";

export default async function Page({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const ctx = await requireCompanyStaff(companySlug);
  const rows = await listMyAssignments(ctx, ctx.userId);
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-5">
      <h1 className="text-2xl">{messages.fieldSitesTitle}</h1>
      <ul className="flex flex-col gap-3 text-sm">
        {rows.map((row) => (
          <li key={row.assignment.id} className="border-t pt-3">
            <Link href={`/app/${companySlug}/field/projects/${row.projectId}/log`}>
              {row.projectTitle}
            </Link>
            <p className="text-muted-foreground">
              {formatSeoul(row.assignment.startsAt)}
              {row.assignment.endsAt ? ` ~ ${formatSeoul(row.assignment.endsAt)}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}

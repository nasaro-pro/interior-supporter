import { redirect } from "next/navigation";
import { requireProjectAccess } from "@/lib/authz/portal";
import { verifyCodeAction } from "@/modules/access";
import { VerifyForm } from "@/components/portal/verify-form";
import { messages } from "@/lib/messages";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx = await requireProjectAccess(projectId);
  if (ctx.verified) redirect(`/portal/${projectId}/home`);
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-4 px-5 py-10">
      <div>
        <p className="gold-label">{messages.verifyTitle}</p>
        <h1 className="mt-2 text-3xl">{messages.verifyTitle}</h1>
      </div>
      <VerifyForm action={verifyCodeAction.bind(null, projectId)} />
    </main>
  );
}

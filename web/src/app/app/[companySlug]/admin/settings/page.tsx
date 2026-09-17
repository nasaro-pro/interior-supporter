import { requireCompanyAdmin } from "@/lib/authz";
import { findCompanyBySlug, updateCompanySettingsAction } from "@/modules/company";
import { Uploader } from "@/components/shared/uploader";
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
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <h1 className="text-3xl">{messages.settingsTitle}</h1>
      <form
        action={updateCompanySettingsAction.bind(null, companySlug)}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1 text-sm">
          {messages.companyNameLabel}
          <input
            name="name"
            required
            defaultValue={company?.name}
            className="h-9 rounded-md border border-input px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {messages.brandColorLabel}
          <input
            name="brandColor"
            defaultValue={company?.brandColor ?? ""}
            className="h-9 rounded-md border border-input px-3"
          />
        </label>
        <p className="text-sm">{messages.brandLogoLabel}</p>
        <Uploader companySlug={companySlug} category="brand" name="brandLogoObjectId" accept="image/jpeg,image/png,image/webp" />
        <button
          type="submit"
          className="ink-btn w-fit"
        >
          {messages.saveSettings}
        </button>
      </form>
    </main>
  );
}

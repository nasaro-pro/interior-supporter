import { requirePlatformAdmin } from "@/lib/authz";
import { listPlatformTemplates, savePlatformTemplateAction } from "@/modules/page-builder";
import { messages } from "@/lib/messages";

export default async function Page() {
  const ctx = await requirePlatformAdmin("플랫폼 템플릿 조회");
  const rows = await listPlatformTemplates(ctx);
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-3xl">{messages.templatesTitle}</h1>
      <form action={savePlatformTemplateAction} className="flex gap-2">
        <input name="name" required className="h-9 flex-1 rounded border px-2" />
        <button type="submit" className="ink-btn">
          {messages.saveTemplate}
        </button>
      </form>
      <ul className="text-sm">
        {rows.map((row) => (
          <li key={row.id}>{row.name}</li>
        ))}
      </ul>
    </main>
  );
}

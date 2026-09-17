import { requirePlatformAdmin } from "@/lib/authz";
import { listPlatformSettings, savePlatformSettingAction } from "@/modules/company";
import { messages } from "@/lib/messages";

export default async function Page() {
  const ctx = await requirePlatformAdmin("플랫폼 설정 조회");
  const rows = await listPlatformSettings(ctx);
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-3xl">{messages.settingsTitle}</h1>
      <ul className="flex flex-col gap-4">
        {rows.map((row) => (
          <li key={row.key} className="border-t pt-3">
            <form action={savePlatformSettingAction} className="flex flex-col gap-2 text-sm">
              <input type="hidden" name="key" value={row.key} />
              <p className="font-medium">{row.key}</p>
              <textarea
                name="value"
                defaultValue={JSON.stringify(row.value)}
                className="min-h-20 rounded border px-2 py-1 font-mono"
              />
              <button type="submit" className="ink-btn w-fit">
                {messages.saveBlocks}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}

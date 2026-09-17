import { DEFAULT_EVENTS, upsertPreference } from "@/modules/notification/repo";

export async function savePreferences(
  userId: string,
  items: { eventType: string; inappEnabled: boolean; emailEnabled: boolean }[],
) {
  const allowed = new Set<string>(DEFAULT_EVENTS);
  const ctx = { kind: "system" as const, job: "notification-prefs" };
  for (const item of items) {
    if (!allowed.has(item.eventType)) continue;
    await upsertPreference(ctx, { userId, ...item });
  }
}

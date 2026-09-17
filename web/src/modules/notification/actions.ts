"use server";

import { requireSession } from "@/lib/auth";
import { requireCompanyStaff } from "@/lib/authz";
import { requireCustomerSession } from "@/lib/authz/portal";
import { DEFAULT_EVENTS, markRead } from "@/modules/notification/repo";
import { savePreferences } from "@/modules/notification/service";

function prefsFromForm(formData: FormData) {
  return DEFAULT_EVENTS.map((eventType) => ({
    eventType,
    inappEnabled: formData.get(`inapp:${eventType}`) === "on",
    emailEnabled: formData.get(`email:${eventType}`) === "on",
  }));
}

export async function saveNotificationPrefsAction(
  companySlug: string,
  formData: FormData,
) {
  const ctx = await requireCompanyStaff(companySlug);
  await savePreferences(ctx.userId, prefsFromForm(formData));
}

export async function savePortalPrefsAction(formData: FormData) {
  const session = await requireCustomerSession();
  await savePreferences(session.userId, prefsFromForm(formData));
}

export async function markInboxReadAction(id: string) {
  const session = await requireSession();
  await markRead(session.userId, id);
}

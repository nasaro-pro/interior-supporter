"use server";

import { redirect } from "next/navigation";
import { requirePlatformIdentity } from "@/lib/authz";
import { confirmPlatformMfa } from "@/lib/auth/platform-mfa";
import { enforceRateLimit } from "@/lib/ratelimit";
import { messages } from "@/lib/messages";
import { ForbiddenError } from "@/lib/errors";

export async function confirmPlatformMfaAction(formData: FormData) {
  const session = await requirePlatformIdentity();
  await enforceRateLimit("platform_mfa", session.userId);
  const ok = await confirmPlatformMfa(
    session.userId,
    String(formData.get("code") ?? ""),
  );
  if (!ok) throw new ForbiddenError(messages.mfaInvalid);
  redirect("/platform");
}

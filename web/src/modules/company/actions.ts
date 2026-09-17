"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCompanyAdmin, requirePlatformAdmin } from "@/lib/authz";
import { DomainError } from "@/lib/errors";
import { messages } from "@/lib/messages";
import {
  updateCompanySettings,
  changeCompanyStatus,
  savePlatformSetting,
  createCompanyByPlatform,
} from "@/modules/company/service";

type ActionState = { ok: false; error: string } | { ok: true } | null;

export async function updateCompanySettingsAction(
  companySlug: string,
  formData: FormData,
) {
  const ctx = await requireCompanyAdmin(companySlug);
  await updateCompanySettings(ctx, companySlug, {
    name: String(formData.get("name") ?? ""),
    brandColor: String(formData.get("brandColor") ?? "") || undefined,
    brandLogoObjectId:
      String(formData.get("brandLogoObjectId") ?? "") || undefined,
  });
  redirect(`/app/${companySlug}/admin/settings`);
}

export async function createCompanyByPlatformAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requirePlatformAdmin("업체 등록");
  try {
    const company = await createCompanyByPlatform(ctx, {
      name: String(formData.get("name") ?? ""),
      businessType: String(formData.get("businessType") ?? "") || undefined,
      adminEmail: String(formData.get("adminEmail") ?? ""),
    });
    redirect(`/platform/companies/${company.id}`);
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) throw error;
    if (error instanceof DomainError) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) return { ok: false, error: messages.internalError };
    return { ok: false, error: messages.internalError };
  }
}

export async function changeCompanyStatusAction(companyId: string, formData: FormData) {
  const ctx = await requirePlatformAdmin("업체 상태 변경");
  await changeCompanyStatus(ctx, companyId, String(formData.get("status") ?? ""));
  redirect(`/platform/companies/${companyId}`);
}

export async function savePlatformSettingAction(formData: FormData) {
  const ctx = await requirePlatformAdmin("플랫폼 설정 변경");
  await savePlatformSetting(
    ctx,
    String(formData.get("key") ?? ""),
    String(formData.get("value") ?? ""),
  );
  redirect("/platform/settings");
}

"use server";

import { revalidatePath } from "next/cache";
import { requireFieldAssignment } from "@/lib/authz";
import { createFieldLog, updateFieldLog } from "@/modules/field-log/service";

export async function createFieldLogAction(
  companySlug: string,
  projectId: string,
  formData: FormData,
) {
  const ctx = await requireFieldAssignment(companySlug, projectId);
  await createFieldLog(ctx, {
    projectId,
    processCategory: String(formData.get("processCategory") ?? "finishing") as
      | "demolition"
      | "electrical"
      | "carpentry"
      | "tile"
      | "film"
      | "flooring"
      | "fixture_setting"
      | "wallpaper"
      | "furniture_install"
      | "lighting_install"
      | "finishing",
    body: String(formData.get("body") ?? ""),
    issue: String(formData.get("issue") ?? "") || undefined,
    status: (String(formData.get("status") ?? "started") || "started") as
      | "started"
      | "in_progress"
      | "done",
  });
  revalidatePath(`/app/${companySlug}/field/projects/${projectId}/log`);
  revalidatePath(`/app/${companySlug}/field`);
}

export async function updateFieldLogAction(
  companySlug: string,
  projectId: string,
  id: string,
  formData: FormData,
) {
  const ctx = await requireFieldAssignment(companySlug, projectId);
  await updateFieldLog(ctx, id, {
    projectId,
    processCategory: String(formData.get("processCategory") ?? "finishing") as
      | "demolition"
      | "electrical"
      | "carpentry"
      | "tile"
      | "film"
      | "flooring"
      | "fixture_setting"
      | "wallpaper"
      | "furniture_install"
      | "lighting_install"
      | "finishing",
    body: String(formData.get("body") ?? ""),
    issue: String(formData.get("issue") ?? "") || undefined,
    status: (String(formData.get("status") ?? "started") || "started") as
      | "started"
      | "in_progress"
      | "done",
  });
  revalidatePath(`/app/${companySlug}/field/projects/${projectId}/log`);
  revalidatePath(`/app/${companySlug}/field`);
}

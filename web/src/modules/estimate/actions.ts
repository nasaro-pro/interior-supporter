"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireProjectInCompany } from "@/lib/authz";
import type { Visibility } from "@/lib/visibility";
import { parseSeoulInputOptional } from "@/lib/datetime";
import {
  changeEstimateVisibility,
  createEstimate,
} from "@/modules/estimate/service";

export async function createEstimateAction(
  companySlug: string,
  projectId: string,
  formData: FormData,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  await createEstimate(ctx, {
    projectId,
    versionName: String(formData.get("versionName") ?? ""),
    changeNote: String(formData.get("changeNote") ?? "") || undefined,
    pdfFileId: String(formData.get("pdfFileId") ?? ""),
  });
  redirect(`/app/${companySlug}/projects/${projectId}/estimates`);
}

export async function changeEstimateVisibilityAction(
  companySlug: string,
  projectId: string,
  id: string,
  formData: FormData,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  await changeEstimateVisibility(
    ctx,
    id,
    String(formData.get("to")) as Visibility,
    parseSeoulInputOptional(String(formData.get("publishAt") ?? "")),
  );
  updateTag(`project:${projectId}`);
}

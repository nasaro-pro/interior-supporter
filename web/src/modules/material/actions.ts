"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireProjectInCompany } from "@/lib/authz";
import { requireProjectVerified } from "@/lib/authz/portal";
import type { Visibility } from "@/lib/visibility";
import { parseSeoulInputOptional } from "@/lib/datetime";
import {
  changeMaterialVisibility,
  changePurchaseStatus,
  createMaterial,
  setMaterialApproval,
} from "@/modules/material/service";

export async function createMaterialAction(
  companySlug: string,
  projectId: string,
  space: string,
  formData: FormData,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  await createMaterial(ctx, {
    projectId,
    spaceCategory: space as
      | "living_room"
      | "kitchen"
      | "bathroom"
      | "bedroom"
      | "lighting"
      | "furniture"
      | "appliance",
    name: String(formData.get("name") ?? ""),
    brand: String(formData.get("brand") ?? "") || undefined,
    spec: String(formData.get("spec") ?? "") || undefined,
    color: String(formData.get("color") ?? "") || undefined,
    applyLocation: String(formData.get("applyLocation") ?? "") || undefined,
    description: String(formData.get("description") ?? "") || undefined,
    imageObjectId: String(formData.get("imageObjectId") ?? "") || undefined,
    externalUrl: String(formData.get("externalUrl") ?? "") || undefined,
  });
  redirect(`/app/${companySlug}/projects/${projectId}/materials?space=${space}`);
}

export async function changeMaterialVisibilityAction(
  companySlug: string,
  projectId: string,
  id: string,
  formData: FormData,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  const to = String(formData.get("to")) as Visibility;
  const publishAtRaw = String(formData.get("publishAt") ?? "");
  await changeMaterialVisibility(
    ctx,
    id,
    to,
    parseSeoulInputOptional(publishAtRaw),
  );
  updateTag(`project:${projectId}`);
}

export async function changePurchaseAction(
  companySlug: string,
  projectId: string,
  id: string,
  to: "quote" | "ordered" | "shipped" | "installed" | "completed",
  formData: FormData,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  await changePurchaseStatus(ctx, id, to, String(formData.get("note") ?? "") || undefined);
}

export async function approveMaterialAction(projectId: string, id: string) {
  const ctx = await requireProjectVerified(projectId);
  await setMaterialApproval(ctx, id, "approved");
  updateTag(`project:${projectId}`);
}

export async function rejectMaterialAction(projectId: string, id: string) {
  const ctx = await requireProjectVerified(projectId);
  await setMaterialApproval(ctx, id, "rejected");
  updateTag(`project:${projectId}`);
}

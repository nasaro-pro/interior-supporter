"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireFieldAssignment, requireProjectInCompany } from "@/lib/authz";
import type { Visibility } from "@/lib/visibility";
import {
  bulkChangePhotoVisibility,
  changePhotoVisibility,
  createPhotos,
  pairPhotos,
} from "@/modules/photo/service";

export async function createPhotosAction(
  companySlug: string,
  projectId: string,
  process: string,
  formData: FormData,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  const objectIds = formData.getAll("objectIds").map(String).filter(Boolean);
  await createPhotos(ctx, {
    projectId,
    processCategory: process as
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
    objectIds,
    shotDate: String(formData.get("shotDate") ?? "") || undefined,
    description: String(formData.get("description") ?? "") || undefined,
    fieldWorkLogId: String(formData.get("fieldWorkLogId") ?? "") || undefined,
  });
  redirect(`/app/${companySlug}/projects/${projectId}/photos?process=${process}`);
}

export async function createFieldPhotosAction(
  companySlug: string,
  projectId: string,
  process: string,
  formData: FormData,
) {
  const ctx = await requireFieldAssignment(companySlug, projectId);
  const objectIds = formData.getAll("objectIds").map(String).filter(Boolean);
  await createPhotos(ctx, {
    projectId,
    processCategory: process as
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
    objectIds,
    shotDate: String(formData.get("shotDate") ?? "") || undefined,
    description: String(formData.get("description") ?? "") || undefined,
    fieldWorkLogId: String(formData.get("fieldWorkLogId") ?? "") || undefined,
  });
  redirect(`/app/${companySlug}/field/projects/${projectId}/photos?process=${process}`);
}

export async function changePhotoVisibilityAction(
  companySlug: string,
  projectId: string,
  id: string,
  formData: FormData,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  const to = String(formData.get("to")) as Visibility;
  await changePhotoVisibility(ctx, id, to);
  updateTag(`project:${projectId}`);
}

export async function bulkPhotoVisibilityAction(
  companySlug: string,
  projectId: string,
  to: Visibility,
  formData: FormData,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  await bulkChangePhotoVisibility(ctx, ids, to);
  updateTag(`project:${projectId}`);
}

export async function pairPhotosAction(
  companySlug: string,
  projectId: string,
  formData: FormData,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  await pairPhotos(ctx, {
    beforeId: String(formData.get("beforeId") ?? ""),
    afterId: String(formData.get("afterId") ?? ""),
  });
}

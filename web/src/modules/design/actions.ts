"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireProjectInCompany } from "@/lib/authz";
import { requireProjectVerified } from "@/lib/authz/portal";
import type { Visibility } from "@/lib/visibility";
import { parseSeoulInputOptional } from "@/lib/datetime";
import {
  createDesignVersion,
  changeDesignVisibility,
  setDesignApproval,
} from "@/modules/design/service";

export async function createDesignAction(
  companySlug: string,
  projectId: string,
  formData: FormData,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  await createDesignVersion(ctx, {
    projectId,
    versionName: String(formData.get("versionName") ?? ""),
    changeNote: String(formData.get("changeNote") ?? "") || undefined,
    storageObjectId: String(formData.get("storageObjectId") ?? ""),
    previewObjectId: String(formData.get("previewObjectId") ?? "") || undefined,
  });
  redirect(`/app/${companySlug}/projects/${projectId}/designs`);
}

export async function changeDesignVisibilityAction(
  companySlug: string,
  projectId: string,
  id: string,
  formData: FormData,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  const to = String(formData.get("to")) as Visibility;
  const publishAtRaw = String(formData.get("publishAt") ?? "");
  await changeDesignVisibility(
    ctx,
    id,
    to,
    parseSeoulInputOptional(publishAtRaw),
  );
  updateTag(`project:${projectId}`);
}

export async function approveDesignAction(
  projectId: string,
  id: string,
  formData: FormData,
) {
  const ctx = await requireProjectVerified(projectId);
  await setDesignApproval(
    ctx,
    id,
    "approved",
    String(formData.get("note") ?? "") || undefined,
  );
  updateTag(`project:${projectId}`);
}

export async function rejectDesignAction(
  projectId: string,
  id: string,
  formData: FormData,
) {
  const ctx = await requireProjectVerified(projectId);
  await setDesignApproval(
    ctx,
    id,
    "rejected",
    String(formData.get("note") ?? "") || undefined,
  );
  updateTag(`project:${projectId}`);
}

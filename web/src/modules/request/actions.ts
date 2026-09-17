"use server";

import { revalidatePath } from "next/cache";
import { requireProjectInCompany } from "@/lib/authz";
import { requireProjectAccess } from "@/lib/authz/portal";
import {
  addRequestCorrection,
  createCustomerRequest,
  respondToRequest,
} from "@/modules/request/service";

export async function createPortalRequestAction(
  projectId: string,
  formData: FormData,
) {
  const ctx = await requireProjectAccess(projectId);
  await createCustomerRequest(ctx, projectId, String(formData.get("body") ?? ""));
  revalidatePath(`/portal/${projectId}/requests`);
}

export async function addRequestCorrectionAction(
  projectId: string,
  requestId: string,
  formData: FormData,
) {
  const ctx = await requireProjectAccess(projectId);
  await addRequestCorrection(ctx, requestId, String(formData.get("body") ?? ""));
  revalidatePath(`/portal/${projectId}/requests`);
}

export async function respondToRequestAction(
  companySlug: string,
  projectId: string,
  requestId: string,
  formData: FormData,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  await respondToRequest(
    ctx,
    requestId,
    String(formData.get("response") ?? ""),
    (String(formData.get("processStatus") ?? "in_progress") || "in_progress") as
      | "open"
      | "in_progress"
      | "done",
  );
  revalidatePath(`/app/${companySlug}/projects/${projectId}/requests`);
}

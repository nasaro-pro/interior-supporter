"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyAdmin, requireProjectInCompany } from "@/lib/authz";
import { grantAssignment, revokeAssignment } from "@/modules/assignment/service";

export async function grantAssignmentAction(
  companySlug: string,
  formData: FormData,
) {
  const projectId = String(formData.get("projectId") ?? "");
  const ctx = await requireProjectInCompany(companySlug, projectId);
  await grantAssignment(ctx, {
    projectId,
    userId: String(formData.get("userId") ?? ""),
    assignmentRole: String(formData.get("assignmentRole") ?? "field_worker") as
      | "designer"
      | "field_worker",
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? "") || undefined,
  });
  revalidatePath(`/app/${companySlug}/admin/assignments`);
}

export async function revokeAssignmentAction(companySlug: string, id: string) {
  const ctx = await requireCompanyAdmin(companySlug);
  await revokeAssignment(ctx, id);
  revalidatePath(`/app/${companySlug}/admin/assignments`);
}

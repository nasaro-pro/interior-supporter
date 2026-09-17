"use server";

import { redirect } from "next/navigation";
import { requireCompanyStaff, requireProjectInCompany } from "@/lib/authz";
import {
  archiveProject,
  createProject,
  processCategory,
  projectStatus,
  updateProject,
} from "@/modules/project/service";

function projectFields(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    customerId: String(formData.get("customerId") ?? ""),
    managerId: String(formData.get("managerId") ?? "") || undefined,
    address: String(formData.get("address") ?? "") || undefined,
    contractDate: String(formData.get("contractDate") ?? "") || undefined,
    startDate: String(formData.get("startDate") ?? "") || undefined,
    endDate: String(formData.get("endDate") ?? "") || undefined,
  };
}

/** 문서① 4.3 — 현재 공정과 진행 상태는 프로젝트 설정에서 바꾼다. */
function updateFields(formData: FormData) {
  const currentProcess = String(formData.get("currentProcess") ?? "");
  const status = String(formData.get("status") ?? "");
  return {
    ...projectFields(formData),
    currentProcess: currentProcess
      ? processCategory.parse(currentProcess)
      : null,
    status: status ? projectStatus.parse(status) : undefined,
  };
}

export async function createProjectAction(
  companySlug: string,
  formData: FormData,
) {
  const ctx = await requireCompanyStaff(companySlug);
  const project = await createProject(ctx, projectFields(formData));
  redirect(`/app/${companySlug}/projects/${project.id}/overview`);
}

export async function updateProjectAction(
  companySlug: string,
  projectId: string,
  formData: FormData,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  await updateProject(ctx, projectId, updateFields(formData));
  redirect(`/app/${companySlug}/projects/${projectId}/settings`);
}

export async function archiveProjectAction(
  companySlug: string,
  projectId: string,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  await archiveProject(ctx, projectId);
  redirect(`/app/${companySlug}/projects`);
}

"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireProjectInCompany } from "@/lib/authz";
import type { Visibility } from "@/lib/visibility";
import {
  changeScheduleVisibility,
  createSchedule,
  scheduleInput,
  updateSchedule,
} from "@/modules/schedule/service";
import type { z } from "zod";
import { parseSeoulInputOptional } from "@/lib/datetime";

function fields(projectId: string, formData: FormData) {
  return {
    projectId,
    type: String(formData.get("type") ?? "visit") as
      | "process"
      | "visit"
      | "confirmed"
      | "meeting",
    title: String(formData.get("title") ?? ""),
    startAt: String(formData.get("startAt") ?? ""),
    endAt: String(formData.get("endAt") ?? "") || undefined,
    isAllDay: formData.get("isAllDay") === "on",
    note: String(formData.get("note") ?? "") || undefined,
    processCategory: (String(formData.get("processCategory") ?? "") ||
      undefined) as z.infer<typeof scheduleInput>["processCategory"],
  };
}

export async function createScheduleAction(
  companySlug: string,
  projectId: string,
  formData: FormData,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  await createSchedule(ctx, fields(projectId, formData));
  redirect(`/app/${companySlug}/projects/${projectId}/schedule`);
}

export async function updateScheduleAction(
  companySlug: string,
  projectId: string,
  id: string,
  formData: FormData,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  await updateSchedule(ctx, id, fields(projectId, formData));
  updateTag(`project:${projectId}`);
}

export async function changeScheduleVisibilityAction(
  companySlug: string,
  projectId: string,
  id: string,
  formData: FormData,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  const to = String(formData.get("to")) as Visibility;
  const publishAtRaw = String(formData.get("publishAt") ?? "");
  await changeScheduleVisibility(
    ctx,
    id,
    to,
    parseSeoulInputOptional(publishAtRaw),
  );
  updateTag(`project:${projectId}`);
}

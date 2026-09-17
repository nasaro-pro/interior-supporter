"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireProjectInCompany } from "@/lib/authz";
import { requireProjectAccess } from "@/lib/authz/portal";
import type { Visibility } from "@/lib/visibility";
import { parseSeoulInputOptional } from "@/lib/datetime";
import {
  ackMeeting,
  changeMeetingVisibility,
  createMeeting,
} from "@/modules/meeting/service";

export async function createMeetingAction(
  companySlug: string,
  projectId: string,
  formData: FormData,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  await createMeeting(ctx, {
    projectId,
    title: String(formData.get("title") ?? ""),
    meetingAt: String(formData.get("meetingAt") ?? ""),
    minutes: String(formData.get("minutes") ?? "") || undefined,
    decisions: String(formData.get("decisions") ?? "") || undefined,
    participants: String(formData.get("participants") ?? "") || undefined,
    attachmentId: String(formData.get("objectId") ?? "") || undefined,
  });
  redirect(`/app/${companySlug}/projects/${projectId}/meetings`);
}

export async function changeMeetingVisibilityAction(
  companySlug: string,
  projectId: string,
  id: string,
  formData: FormData,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  await changeMeetingVisibility(
    ctx,
    id,
    String(formData.get("to")) as Visibility,
    parseSeoulInputOptional(String(formData.get("publishAt") ?? "")),
  );
  updateTag(`project:${projectId}`);
}

export async function ackMeetingAction(projectId: string, meetingId: string, formData: FormData) {
  const ctx = await requireProjectAccess(projectId);
  await ackMeeting(ctx, meetingId, String(formData.get("body") ?? ""));
  revalidatePath(`/portal/${projectId}/meetings`);
}

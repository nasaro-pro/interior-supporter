"use server";

import { revalidatePath } from "next/cache";
import { requireProjectInCompany } from "@/lib/authz";
import { requireProjectAccess, requireProjectVerified } from "@/lib/authz/portal";
import { createComment, deleteComment, editComment } from "@/modules/comment/service";

export async function createCommentAction(
  companySlug: string,
  projectId: string,
  formData: FormData,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  await createComment(ctx, {
    projectId,
    body: String(formData.get("body") ?? ""),
    parentId: String(formData.get("parentId") ?? "") || undefined,
  });
}

export async function createPortalCommentAction(
  projectId: string,
  formData: FormData,
) {
  const binding = formData.get("binding") === "on";
  const ctx = binding
    ? await requireProjectVerified(projectId)
    : await requireProjectAccess(projectId);
  await createComment(ctx, {
    projectId,
    body: String(formData.get("body") ?? ""),
    parentId: String(formData.get("parentId") ?? "") || undefined,
    binding,
  });
  revalidatePath(`/portal/${projectId}/requests`);
  revalidatePath(`/portal/${projectId}/home`);
}

export async function editCommentAction(
  companySlug: string,
  projectId: string,
  id: string,
  formData: FormData,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  await editComment(ctx, id, String(formData.get("body") ?? ""));
}

/** 문서② 4.5 — 고객은 본인이 쓴 일반 댓글을 수정할 수 있다. */
export async function editPortalCommentAction(
  projectId: string,
  id: string,
  formData: FormData,
) {
  const ctx = await requireProjectAccess(projectId);
  await editComment(ctx, id, String(formData.get("body") ?? ""));
}

export async function deleteCommentAction(
  companySlug: string,
  projectId: string,
  id: string,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  await deleteComment(ctx, id);
}

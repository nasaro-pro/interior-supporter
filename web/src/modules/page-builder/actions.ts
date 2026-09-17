"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requirePlatformAdmin, requireProjectInCompany, requireCompanyAdmin, requirePublicContact } from "@/lib/authz";
import { ConflictError, ForbiddenError } from "@/lib/errors";
import { messages } from "@/lib/messages";
import { sendMail } from "@/lib/notify/channels/email";
import { env } from "@/lib/config/env";
import {
  saveHomeBlocks,
  saveAsProjectTemplate,
  applyTemplate,
  requestTemplatePromotion,
  approveTemplatePromotion,
  rejectTemplatePromotion,
  savePlatformTemplate,
} from "@/modules/page-builder/service";

export async function saveHomeBlocksAction(
  companySlug: string,
  projectId: string,
  payload: {
    pageUpdatedAt: string;
    blocks: Array<{
      id: string;
      blockType:
        | "text"
        | "gallery"
        | "before_after"
        | "design_file"
        | "material_card"
        | "schedule"
        | "comment"
        | "process"
        | "button"
        | "divider";
      layout: { x: number; y: number; w: number; h: number };
      style: Record<string, unknown>;
      content: unknown;
      visibilityStatus: "draft" | "review" | "scheduled" | "published";
      publishAt?: string | null;
      deleted?: boolean;
      isNew?: boolean;
    }>;
  },
): Promise<{ ok: true; pageUpdatedAt: string } | { ok: false; error: string }> {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  try {
    const page = await saveHomeBlocks(ctx, {
      projectId,
      pageUpdatedAt: payload.pageUpdatedAt,
      blocks: payload.blocks,
    });
    // 9.4 — 저장 성공 후 고객 화면 캐시를 즉시 무효화한다 (16.3).
    updateTag(`project:${projectId}`);
    // 다음 저장에 쓸 새 버전 토큰(µs 정밀도)을 그대로 돌려준다.
    return { ok: true, pageUpdatedAt: page.token };
  } catch (error) {
    if (error instanceof ConflictError) return { ok: false, error: error.message };
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function saveProjectTemplateAction(
  companySlug: string,
  projectId: string,
  formData: FormData,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  await saveAsProjectTemplate(ctx, projectId, String(formData.get("name") ?? ""));
  // 16.3 — 템플릿 적용도 고객 화면 구성을 바꾼다.
  updateTag(`project:${projectId}`);
  revalidatePath(`/app/${companySlug}/projects/${projectId}/home-editor`);
}

export async function applyTemplateAction(
  companySlug: string,
  projectId: string,
  formData: FormData,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  await applyTemplate(
    ctx,
    projectId,
    String(formData.get("templateId") ?? ""),
    formData.get("mode") === "append" ? "append" : "overwrite",
  );
  revalidatePath(`/app/${companySlug}/projects/${projectId}/home-editor`);
}

export async function requestPromotionAction(
  companySlug: string,
  projectId: string,
  templateId: string,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  await requestTemplatePromotion(ctx, templateId);
}

export async function approvePromotionAction(companySlug: string, templateId: string) {
  const ctx = await requireCompanyAdmin(companySlug);
  await approveTemplatePromotion(ctx, templateId);
  revalidatePath(`/app/${companySlug}/admin/templates`);
}

export async function rejectPromotionAction(
  companySlug: string,
  templateId: string,
  formData: FormData,
) {
  const ctx = await requireCompanyAdmin(companySlug);
  await rejectTemplatePromotion(ctx, templateId, String(formData.get("note") ?? ""));
  revalidatePath(`/app/${companySlug}/admin/templates`);
}

export async function savePlatformTemplateAction(formData: FormData) {
  const ctx = await requirePlatformAdmin("플랫폼 템플릿 저장");
  await savePlatformTemplate(ctx, String(formData.get("name") ?? ""), []);
}

export async function submitContactAction(
  _prev: { ok: true } | { ok: false; error: string } | null,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePublicContact();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  if (!title || !body || !contact) {
    return { ok: false, error: messages.internalError };
  }
  await sendMail({
    to: env.NOTIFY_FROM_EMAIL,
    template: "contact",
    data: { subject: title, body: `${contact}\n\n${body}` },
  });
  return { ok: true };
}

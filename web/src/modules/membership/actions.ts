"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, clearPendingSignupConsent, setPendingSignupConsent } from "@/lib/auth/server";
import { getSession, requireSession } from "@/lib/auth";
import {
  postLoginPath,
  requestIp,
  requestMeta,
  requireCompanyAdmin,
  requirePlatformAdmin,
} from "@/lib/authz";
import { recordAudit } from "@/modules/audit";
import { getPlatformSetting } from "@/modules/company/repo";
import { createCompany } from "@/modules/company/service";
import { enforceRateLimit } from "@/lib/ratelimit";
import { DomainError, RateLimitError } from "@/lib/errors";
import { messages } from "@/lib/messages";
import {
  deactivateMember,
  deactivateMemberByPlatform,
  inviteMember,
  inviteMemberByPlatform,
  toggleProjectManager,
  toggleProjectManagerByPlatform,
} from "@/modules/membership/service";

const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email(),
  password: z.string().min(10),
  termsAgreed: z.literal("on"),
  transferAgreed: z.literal("on"),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

/** 개인정보 원문을 감사에 남기지 않으면서 반복 실패를 집계하기 위한 식별자 (12.1) */
function emailDigest(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 16);
}

type ActionState = { ok: false; error: string } | { ok: true } | null;

function formError(message: string): ActionState {
  return { ok: false, error: message };
}

function catchAction(error: unknown) {
  if (error instanceof RateLimitError) return formError(messages.rateLimited);
  if (error instanceof DomainError) return formError(error.message);
  if (error instanceof z.ZodError) {
    const authIssue = error.issues.some((i) => i.path.includes("password"));
    if (authIssue) return formError(messages.passwordMin);
    return formError(messages.internalError);
  }
  return formError(messages.internalError);
}

export async function signUpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const ip = await requestIp(await headers());
    await enforceRateLimit("signup_ip", ip);
    const parsed = signupSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      termsAgreed: formData.get("termsAgreed"),
      transferAgreed: formData.get("transferAgreed"),
    });
    if (!parsed.success) {
      if (
        formData.get("termsAgreed") !== "on" ||
        formData.get("transferAgreed") !== "on"
      ) {
        return formError(messages.consentsRequired);
      }
      return formError(messages.passwordMin);
    }
    const termsVersion = String(
      (await getPlatformSetting("terms_version")) ?? "unspecified",
    );
    const transferVersion = String(
      (await getPlatformSetting("privacy_transfer_version")) ?? "unspecified",
    );
    const agreedAt = new Date().toISOString();
    setPendingSignupConsent(parsed.data.email, {
      termsVersion,
      transferVersion,
      termsAgreedAt: agreedAt,
      transferAgreedAt: agreedAt,
    });
    await auth.api.signUpEmail({
      body: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
      },
      headers: await headers(),
    });
    redirect("/verify-email");
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) throw error;
    clearPendingSignupConsent(String(formData.get("email") ?? ""));
    return catchAction(error);
  }
}

export async function signInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  try {
    const ip = await requestIp(await headers());
    await enforceRateLimit("login_ip", ip);
    await enforceRateLimit("login_account", email.toLowerCase());
    const parsed = loginSchema.parse({
      email,
      password: formData.get("password"),
    });
    const meta = await requestMeta();
    let signedIn: { user: { id: string } } | null = null;
    try {
      signedIn = await auth.api.signInEmail({
        body: { email: parsed.email, password: parsed.password },
        headers: await headers(),
      });
    } catch {
      // 12.1 — 화면 메시지는 계정 존재를 노출하지 않지만, 감사 기록에는
      // 동일 계정 반복 실패를 집계할 단서가 있어야 한다. 원문 대신 해시를 남긴다.
      await recordAudit({
        action: "login_failed",
        targetType: "user",
        after: { emailDigest: emailDigest(parsed.email) },
        ...meta,
      });
      return formError(messages.loginFailed);
    }
    // signInEmail 이 방금 발급한 세션 쿠키는 '응답'에 실린다.
    // 이 액션 안에서 getSession() 을 다시 부르면 '요청' 헤더를 읽으므로
    // 아직 쿠키가 없어 항상 null 이 된다. 반환값의 user 를 그대로 쓴다.
    const userId = signedIn?.user?.id;
    if (!userId) return formError(messages.loginFailed);
    await recordAudit({
      action: "login",
      targetType: "user",
      targetId: userId,
      ...meta,
    });
    redirect(await postLoginPath(userId));
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) throw error;
    if (error instanceof RateLimitError) return formError(messages.rateLimited);
    return catchAction(error);
  }
}

export async function forgotPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const email = z.email().parse(formData.get("email"));
    await enforceRateLimit("email_per_minute", email);
    await enforceRateLimit("email_per_day", email);
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: "/reset-password" },
      headers: await headers(),
    });
    return { ok: true as const };
  } catch (error) {
    if (error instanceof RateLimitError) return formError(messages.rateLimited);
    return { ok: true as const };
  }
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const password = z.string().min(10).parse(formData.get("password"));
    const token = z.string().min(1).parse(formData.get("token"));
    await auth.api.resetPassword({
      body: { newPassword: password, token },
      headers: await headers(),
    });
    const session = await getSession();
    if (session) {
      // 14.2 — 재설정 직후 모든 기기의 세션을 폐기한다.
      const { revokeAllSessions } = await import("@/lib/auth");
      await revokeAllSessions(session.userId);
    }
    await recordAudit({
      action: "password_reset",
      targetType: "user",
      targetId: session?.userId,
      ...(await requestMeta()),
    });
    redirect("/login");
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) throw error;
    return catchAction(error);
  }
}

export async function createCompanyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (session.isPlatformAdmin) redirect("/platform");
  try {
    const company = await createCompany(session.userId, {
      name: String(formData.get("name") ?? ""),
      businessType: String(formData.get("businessType") ?? "") || undefined,
    });
    redirect(`/app/${company.slug}/admin`);
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) throw error;
    return catchAction(error);
  }
}

export async function inviteMemberAction(
  companySlug: string,
  formData: FormData,
): Promise<void> {
  const ctx = await requireCompanyAdmin(companySlug);
  await inviteMember(ctx, {
    email: String(formData.get("email") ?? ""),
    role: formData.get("role") === "company_admin"
      ? "company_admin"
      : "project_manager",
  });
}

export async function togglePmAction(
  companySlug: string,
  userId: string,
  enable: boolean,
): Promise<void> {
  const ctx = await requireCompanyAdmin(companySlug);
  await toggleProjectManager(ctx, userId, enable);
}

export async function deactivateMemberAction(
  companySlug: string,
  userId: string,
): Promise<void> {
  const ctx = await requireCompanyAdmin(companySlug);
  await deactivateMember(ctx, userId);
}

export async function invitePlatformMemberAction(
  companyId: string,
  formData: FormData,
): Promise<void> {
  const ctx = await requirePlatformAdmin("업체 구성원 초대");
  await inviteMemberByPlatform(ctx, companyId, {
    email: String(formData.get("email") ?? ""),
    role: formData.get("role") === "company_admin"
      ? "company_admin"
      : "project_manager",
  });
}

export async function togglePlatformPmAction(
  companyId: string,
  userId: string,
  enable: boolean,
): Promise<void> {
  const ctx = await requirePlatformAdmin("업체 구성원 역할 변경");
  await toggleProjectManagerByPlatform(ctx, companyId, userId, enable);
}

export async function deactivatePlatformMemberAction(
  companyId: string,
  userId: string,
): Promise<void> {
  const ctx = await requirePlatformAdmin("업체 구성원 비활성화");
  await deactivateMemberByPlatform(ctx, companyId, userId);
}

export async function savePortalProfileAction(formData: FormData) {
  const session = await requireSession();
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(100),
      phone: z.string().trim().max(30).optional(),
    })
    .parse({
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? "") || undefined,
    });
  const { updateUserProfile } = await import("@/modules/membership/repo");
  await updateUserProfile(session.userId, {
    name: parsed.name,
    phone: parsed.phone ?? null,
  });
}

export async function changePortalPasswordAction(formData: FormData) {
  const { changeOwnPassword } = await import("@/lib/auth");
  await changeOwnPassword(
    String(formData.get("currentPassword") ?? ""),
    z.string().min(10).parse(formData.get("newPassword")),
  );
}

export async function signOutAction() {
  const { getSession, signOut } = await import("@/lib/auth");
  const session = await getSession();
  if (session) {
    const meta = await requestMeta();
    await recordAudit({
      action: "logout",
      targetType: "user",
      targetId: session.userId,
      ...meta,
    });
    await signOut();
  }
  redirect("/login");
}

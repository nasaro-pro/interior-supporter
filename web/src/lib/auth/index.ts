import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, deleteSessionsForUser, findAuthUser } from "@/lib/auth/server";
import { clearMfaCookie } from "@/lib/auth/platform-mfa";
export { hashCredentialPassword } from "@/lib/auth/password";
export {
  hasValidPlatformMfa,
  hasEnrolledPlatformMfa,
  loadPendingPlatformMfa,
  confirmPlatformMfa,
} from "@/lib/auth/platform-mfa";

export type AppSession = {
  userId: string;
  email: string;
  name: string;
  emailVerified: boolean;
  isPlatformAdmin: boolean;
};

export async function getSession(): Promise<AppSession | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await findAuthUser(session.user.id);
  if (!user || !user.isActive) {
    await deleteSessionsForUser(session.user.id);
    return null;
  }
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    isPlatformAdmin: user.isPlatformAdmin,
  };
}

export async function requireSession(): Promise<AppSession> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function signOut(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  (await cookies()).delete("invite_token");
  await clearMfaCookie();
}

export async function getAccount() {
  const session = await requireSession();
  const user = await findAuthUser(session.userId);
  if (!user) redirect("/login");
  return user;
}

/**
 * ARCHITECTURE.md 14.2 — 비밀번호가 바뀌면 그 계정의 모든 세션을 즉시 폐기한다.
 * 탈취된 세션이 비밀번호 변경 후에도 살아 있으면 안 된다.
 */
export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
) {
  const session = await requireSession();
  await auth.api.changePassword({
    body: { currentPassword, newPassword },
    headers: await headers(),
  });
  await revokeAllSessions(session.userId);
}

/** 비밀번호 변경·재설정 직후 호출한다. */
export async function revokeAllSessions(userId: string) {
  await deleteSessionsForUser(userId);
}

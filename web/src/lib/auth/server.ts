import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { env } from "@/lib/config/env";
import { sendMail } from "@/lib/notify/channels/email";
import { recordAudit } from "@/modules/audit";
import {
  accounts,
  sessions,
  users,
  verifications,
} from "@/modules/membership/schema";
import { db } from "../db/client";

export type SignupConsent = {
  termsVersion: string;
  transferVersion: string;
  termsAgreedAt: string;
  transferAgreedAt: string;
};

const pendingConsent = new Map<string, SignupConsent>();

export function setPendingSignupConsent(email: string, consent: SignupConsent) {
  pendingConsent.set(email.toLowerCase(), consent);
}

export function clearPendingSignupConsent(email: string) {
  pendingConsent.delete(email.toLowerCase());
}

function takePendingSignupConsent(email: string) {
  const key = email.toLowerCase();
  const value = pendingConsent.get(key);
  pendingConsent.delete(key);
  return value;
}

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { users, sessions, accounts, verifications },
    usePlural: true,
  }),
  advanced: {
    database: { generateId: () => randomUUID() },
    useSecureCookies: env.NODE_ENV === "production",
    defaultCookieAttributes: { sameSite: "lax", httpOnly: true },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendMail({ to: user.email, template: "password-reset", data: { url } });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendMail({ to: user.email, template: "verify-email", data: { url } });
    },
    afterEmailVerification: async (user) => {
      await recordAudit({
        action: "email_verified",
        targetType: "user",
        targetId: user.id,
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
  },
  user: {
    additionalFields: {
      isPlatformAdmin: { type: "boolean", defaultValue: false, input: false },
      phone: { type: "string", required: false, input: true },
      isActive: { type: "boolean", defaultValue: true, input: false },
    },
  },
  plugins: [nextCookies()],
  databaseHooks: {
    user: {
      create: {
        before: async (data) => {
          const email =
            typeof data.email === "string" ? data.email.toLowerCase() : "";
          if (!pendingConsent.has(email)) return false;
          return { data };
        },
        after: async (user) => {
          if (!user) return;
          const consent = takePendingSignupConsent(user.email);
          try {
            await recordAudit({
              action: "signup",
              targetType: "user",
              targetId: user.id,
              after: consent,
            });
          } catch (error) {
            await db.delete(users).where(eq(users.id, user.id));
            throw error;
          }
        },
      },
    },
  },
});

export async function findAuthUser(userId: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

export async function deleteSessionsForUser(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export { hashCredentialPassword } from "@/lib/auth/password";

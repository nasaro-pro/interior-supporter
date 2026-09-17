import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { env } from "@/lib/config/env";
import { db } from "@/lib/db/client";
import { getPlatformSetting } from "@/modules/company/repo";
import { verifications } from "@/modules/membership/schema";
import { randomTotpSecret, totpUri, verifyTotp } from "@/lib/auth/totp";

const COOKIE = "platform_mfa";
const ENROLLED = "platform-totp:";
const PENDING = "platform-totp-pending:";

function settingNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return null;
}

async function mfaTtlHours() {
  const hours = settingNumber(await getPlatformSetting("mfa_ttl_hours"));
  if (!hours || Number.isNaN(hours) || hours <= 0) {
    throw new Error("platform_settings.mfa_ttl_hours 가 없습니다. pnpm db:seed 를 실행하세요.");
  }
  return hours;
}

function signCookie(userId: string, issuedAt: string) {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`${userId}:${issuedAt}`)
    .digest("base64url");
}

function cookieOk(userId: string, raw: string, ttlMs: number) {
  const [issuedAt, mac] = raw.split(".");
  if (!issuedAt || !mac) return false;
  const issued = Number(issuedAt);
  if (!Number.isFinite(issued) || Date.now() - issued > ttlMs) return false;
  const expected = Buffer.from(signCookie(userId, issuedAt));
  const actual = Buffer.from(mac);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

async function findByIdentifier(identifier: string) {
  const [row] = await db
    .select()
    .from(verifications)
    .where(eq(verifications.identifier, identifier))
    .limit(1);
  return row ?? null;
}

async function upsertVerification(identifier: string, value: string, expiresAt: Date) {
  const existing = await findByIdentifier(identifier);
  if (existing) {
    await db
      .update(verifications)
      .set({ value, expiresAt, updatedAt: new Date() })
      .where(eq(verifications.id, existing.id));
    return;
  }
  await db.insert(verifications).values({ identifier, value, expiresAt });
}

async function deleteByIdentifier(identifier: string) {
  await db.delete(verifications).where(eq(verifications.identifier, identifier));
}

export async function hasEnrolledPlatformMfa(userId: string) {
  const row = await findByIdentifier(`${ENROLLED}${userId}`);
  return Boolean(row?.value);
}

export async function loadPendingPlatformMfa(userId: string, email: string, issuer: string) {
  if (await hasEnrolledPlatformMfa(userId)) return null;
  const identifier = `${PENDING}${userId}`;
  const existing = await findByIdentifier(identifier);
  const hours = await mfaTtlHours();
  const secret =
    existing && existing.expiresAt > new Date() ? existing.value : randomTotpSecret();
  if (!existing || existing.expiresAt <= new Date()) {
    await upsertVerification(
      identifier,
      secret,
      new Date(Date.now() + hours * 60 * 60 * 1000),
    );
  }
  return { secret, uri: totpUri(secret, email, issuer) };
}

export async function confirmPlatformMfa(userId: string, token: string) {
  const pending = await findByIdentifier(`${PENDING}${userId}`);
  const enrolled = await findByIdentifier(`${ENROLLED}${userId}`);
  const secret = pending?.value ?? enrolled?.value;
  if (!secret) return false;
  if (!verifyTotp(secret, token)) return false;
  if (pending) {
    await upsertVerification(
      `${ENROLLED}${userId}`,
      pending.value,
      new Date("2099-01-01T00:00:00.000Z"),
    );
    await deleteByIdentifier(`${PENDING}${userId}`);
  }
  await writeMfaCookie(userId);
  return true;
}

export async function hasValidPlatformMfa(userId: string) {
  if (!(await hasEnrolledPlatformMfa(userId))) return false;
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return false;
  const hours = await mfaTtlHours();
  return cookieOk(userId, raw, hours * 60 * 60 * 1000);
}

export async function writeMfaCookie(userId: string) {
  const hours = await mfaTtlHours();
  const issuedAt = String(Date.now());
  const jar = await cookies();
  jar.set(COOKIE, `${issuedAt}.${signCookie(userId, issuedAt)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: env.NODE_ENV === "production",
    maxAge: Math.floor(hours * 60 * 60),
  });
}

export async function clearMfaCookie() {
  (await cookies()).set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: env.NODE_ENV === "production",
    maxAge: 0,
  });
}

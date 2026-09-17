import { lookup } from "node:dns/promises";
import { ForbiddenError } from "@/lib/errors";
import { messages } from "@/lib/messages";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "metadata.google.com",
]);

export function isPrivateIp(ip: string) {
  const v4 = ip.split(".").map(Number);
  if (v4.length === 4 && v4.every((n) => n >= 0 && n <= 255)) {
    const [a, b] = v4;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  const lower = ip.toLowerCase();
  return (
    lower === "::1" ||
    lower.startsWith("fe80:") ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("::ffff:127.") ||
    lower.startsWith("::ffff:10.") ||
    lower.startsWith("::ffff:192.168.")
  );
}

export async function assertPublicHttpUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ForbiddenError(messages.linkPreviewDenied);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ForbiddenError(messages.linkPreviewDenied);
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost")) {
    throw new ForbiddenError(messages.linkPreviewDenied);
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new ForbiddenError(messages.linkPreviewDenied);
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
    throw new ForbiddenError(messages.linkPreviewDenied);
  }
  return url;
}

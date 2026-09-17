import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PERIOD = 30;
const DIGITS = 6;
const WINDOW = 1;

export function randomTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

export function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPH[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPH[(value << (5 - bits)) & 31];
  return out;
}

export function decodeBase32(input: string): Uint8Array {
  const cleaned = input.replace(/=+$/g, "").toUpperCase().replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of cleaned) {
    const idx = ALPH.indexOf(ch);
    if (idx < 0) throw new Error("invalid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

function hotp(secret: Uint8Array, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", Buffer.from(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const bin =
    ((hmac[offset]! & 0x7f) << 24) |
    (hmac[offset + 1]! << 16) |
    (hmac[offset + 2]! << 8) |
    hmac[offset + 3]!;
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

function equalCode(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function generateTotp(secretBase32: string, now = Date.now()): string {
  const secret = decodeBase32(secretBase32);
  const counter = Math.floor(now / 1000 / PERIOD);
  return hotp(secret, counter);
}

export function verifyTotp(secretBase32: string, token: string, now = Date.now()): boolean {
  const code = token.trim();
  if (!/^\d{6}$/.test(code)) return false;
  const secret = decodeBase32(secretBase32);
  const counter = Math.floor(now / 1000 / PERIOD);
  for (let i = -WINDOW; i <= WINDOW; i++) {
    if (equalCode(hotp(secret, counter + i), code)) return true;
  }
  return false;
}

export function totpUri(secret: string, account: string, issuer: string) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const query = new URLSearchParams({
    secret,
    issuer,
    digits: String(DIGITS),
    period: String(PERIOD),
    algorithm: "SHA1",
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

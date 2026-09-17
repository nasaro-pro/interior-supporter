import { hashPassword } from "better-auth/crypto";

export async function hashCredentialPassword(password: string) {
  return hashPassword(password);
}

import { existsSync, readFileSync } from "node:fs";
import postgres from "postgres";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const url = process.env.DATABASE_URL;
const userId = process.argv.find((arg) => /^[0-9a-f-]{36}$/i.test(arg));
const confirm = process.argv.includes("--confirm");
if (!url) {
  console.error("DATABASE_URL 이 없습니다.");
  process.exit(1);
}
if (!userId || !confirm) {
  console.error("사용법: pnpm privacy:erase -- <users.id UUID> --confirm");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const [user] = await sql`SELECT id, is_platform_admin FROM users WHERE id = ${userId}`;
if (!user) {
  console.error("계정이 없습니다.");
  await sql.end();
  process.exit(1);
}
if (user.is_platform_admin) {
  console.error("플랫폼 운영자 계정은 이 스크립트로 파기하지 않습니다.");
  await sql.end();
  process.exit(1);
}

const tombstoneEmail = `deleted.${userId.replaceAll("-", "")}@invalid.local`;

await sql.begin(async (tx) => {
  await tx`
    UPDATE users
    SET
      name = '탈퇴한 사용자',
      email = ${tombstoneEmail},
      phone = NULL,
      is_active = false,
      updated_at = now()
    WHERE id = ${userId}
  `;
  await tx`DELETE FROM sessions WHERE user_id = ${userId}`;
  await tx`
    UPDATE project_access
    SET revoked_at = now()
    WHERE user_id = ${userId} AND revoked_at IS NULL
  `;
  const memberships = await tx`
    UPDATE memberships
    SET is_active = false, revoked_at = now()
    WHERE user_id = ${userId} AND is_active = true
    RETURNING id, company_id
  `;
  for (const row of memberships) {
    await tx`
      INSERT INTO audit_logs (company_id, actor_id, actor_label, action_type, target_type, target_id, after)
      VALUES (
        ${row.company_id},
        NULL,
        'system',
        'member_deactivate',
        'membership',
        ${row.id},
        ${tx.json({ reason: "privacy_erase" })}
      )
    `;
  }
});

await sql.end();
console.log(`anonymized ${userId}`);

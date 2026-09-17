import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

const here = dirname(fileURLToPath(import.meta.url));
loadEnvFile(join(here, "../../web/.env.local"));
loadEnvFile(join(here, "../../web/.env"));

const userId = process.argv.includes("--user-id")
  ? process.argv[process.argv.indexOf("--user-id") + 1]
  : process.env.USER_ID;
if (!userId) {
  console.error("--user-id 가 필요합니다.");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL 이 없습니다.");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const objects = await sql`
  select id, object_key, thumb_key from storage_objects
  where uploaded_by = ${userId} and deleted_at is null
`;
const local = join(here, "../../web/.local-storage");
for (const row of objects) {
  try {
    unlinkSync(join(local, ...String(row.object_key).split("/")));
  } catch {
    // 로컬 파일이 없으면 건너뛴다. R2 는 운영 런북에서 별도 삭제한다.
  }
  if (row.thumb_key) {
    try {
      unlinkSync(join(local, ...String(row.thumb_key).split("/")));
    } catch {
      // ignore
    }
  }
}

await sql.begin(async (tx) => {
  await tx`update storage_objects set deleted_at = now() where uploaded_by = ${userId} and deleted_at is null`;
  await tx`delete from sessions where user_id = ${userId}`;
  await tx`delete from accounts where user_id = ${userId}`;
  await tx`update comments set body = '', deleted_at = now() where author_id = ${userId} and deleted_at is null`;
  await tx`update project_access set revoked_at = now() where user_id = ${userId} and revoked_at is null`;
  await tx`update memberships set is_active = false, revoked_at = now() where user_id = ${userId} and is_active = true`;
  await tx`update users set email = ${`deleted-${userId}@invalid`}, name = 'deleted', phone = null, is_active = false where id = ${userId}`;
  await tx`
    insert into audit_logs (action_type, target_type, target_id, after)
    values ('member_deactivate', 'user', ${userId}, ${tx.json({ destroyed: true })})
  `;
});

await sql.end();
console.log(`destroyed ${userId}`);

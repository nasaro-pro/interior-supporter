import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
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
const [user] = await sql`select id, email, name, created_at from users where id = ${userId}`;
if (!user) {
  console.error("계정을 찾을 수 없습니다.");
  await sql.end();
  process.exit(1);
}
const memberships = await sql`select company_id, role, is_active from memberships where user_id = ${userId}`;
const access = await sql`select project_id, company_id, revoked_at from project_access where user_id = ${userId}`;
const comments = await sql`select id, project_id, kind, created_at from comments where author_id = ${userId}`;
const payload = {
  user: { id: user.id, email: user.email, name: user.name, createdAt: user.created_at },
  memberships,
  projectAccess: access,
  comments,
};
const out = join(here, `export-${userId}.json`);
mkdirSync(here, { recursive: true });
writeFileSync(out, JSON.stringify(payload, null, 2));
await sql.end();
console.log(`wrote ${out}`);

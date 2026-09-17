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
const userId = process.argv.find((arg) =>
  /^[0-9a-f-]{36}$/i.test(arg),
);
if (!url) {
  console.error("DATABASE_URL 이 없습니다.");
  process.exit(1);
}
if (!userId) {
  console.error("사용법: pnpm privacy:export -- <users.id UUID>");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const [user] = await sql`
  SELECT id, email, name, phone, email_verified, is_active, is_platform_admin, created_at
  FROM users WHERE id = ${userId}
`;
if (!user) {
  console.error("계정이 없습니다.");
  await sql.end();
  process.exit(1);
}

const memberships = await sql`
  SELECT id, company_id, role, is_active, created_at
  FROM memberships WHERE user_id = ${userId}
`;
const access = await sql`
  SELECT id, company_id, project_id, granted_at
  FROM project_access WHERE user_id = ${userId} AND revoked_at IS NULL
`;
const requests = await sql`
  SELECT id, project_id, created_at
  FROM customer_requests WHERE author_id = ${userId} AND deleted_at IS NULL
`;
const comments = await sql`
  SELECT id, project_id, kind, created_at
  FROM comments WHERE author_id = ${userId} AND deleted_at IS NULL
`;
const logs = await sql`
  SELECT id, project_id, work_date, status
  FROM field_work_logs WHERE author_id = ${userId} AND deleted_at IS NULL
`;
const verifications = await sql`
  SELECT project_id, code_version, verified_at
  FROM project_verifications WHERE user_id = ${userId}
`;

await sql.end();

process.stdout.write(
  JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        emailVerified: user.email_verified,
        isActive: user.is_active,
        isPlatformAdmin: user.is_platform_admin,
        createdAt: user.created_at,
      },
      memberships,
      projectAccess: access,
      authoredRequestIds: requests.map((row) => row.id),
      authoredCommentIds: comments.map((row) => ({
        id: row.id,
        kind: row.kind,
        projectId: row.project_id,
      })),
      fieldLogs: logs,
      verifiedProjects: verifications.map((row) => row.project_id),
    },
    null,
    2,
  ),
);

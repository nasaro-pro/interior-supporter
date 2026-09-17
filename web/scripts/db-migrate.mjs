import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
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

const generated = spawnSync("pnpm", ["exec", "drizzle-kit", "migrate"], {
  stdio: "inherit",
  shell: true,
});
if (generated.status !== 0) {
  process.exit(generated.status ?? 1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL 이 없습니다.");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const manualDir = join(process.cwd(), "drizzle", "manual");
const files = readdirSync(manualDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

await sql`CREATE TABLE IF NOT EXISTS drizzle_manual_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
)`;

for (const file of files) {
  const applied = await sql`SELECT id FROM drizzle_manual_migrations WHERE id = ${file}`;
  if (applied.length > 0) continue;
  const body = readFileSync(join(manualDir, file), "utf8");
  await sql.unsafe(body);
  await sql`INSERT INTO drizzle_manual_migrations (id) VALUES (${file})`;
  console.log(`applied manual ${file}`);
}

await sql.end();

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
if (!url) {
  console.error("DATABASE_URL 이 없습니다.");
  process.exit(1);
}

const settings = [
  // ARCHITECTURE.md 13.1 — 유료화 전에는 false. 이 값만 바꾸면 제한이 켜진다.
  ["plan_enforcement_enabled", false],
  // 문서② 7장 요금제-기능 매트릭스의 수치 부분. null = 무제한.
  [
    "plan_limits",
    {
      free: { active_projects: 1, pm_seats: 1, storage_mb: 1024 },
      starter: { active_projects: 10, pm_seats: 2, storage_mb: 20480 },
      pro: { active_projects: null, pm_seats: 5, storage_mb: 102400 },
      enterprise: { active_projects: null, pm_seats: null, storage_mb: null },
    },
  ],
  [
    "audit_retention_days",
    { default: 180, free: 30, starter: 90, pro: 365, enterprise: null },
  ],
  ["verify_code_length", 8],
  ["verify_attempt_limit", 5],
  ["verify_attempt_window_min", 10],
  ["invite_expire_days", 7],
  ["max_image_mb", 20],
  ["max_pdf_mb", 50],
  ["mfa_ttl_hours", 12],
  ["terms_version", "2026-09-12"],
  ["privacy_transfer_version", "2026-09-12"],
  [
    "rate_limits",
    {
      login_account: { window_ms: 600000, limit: 10 },
      login_ip: { window_ms: 600000, limit: 30 },
      signup_ip: { window_ms: 3600000, limit: 5 },
      email_per_minute: { window_ms: 60000, limit: 1 },
      email_per_day: { window_ms: 86400000, limit: 5 },
      invite_ip: { window_ms: 600000, limit: 20 },
      file_proxy: { window_ms: 60000, limit: 300 },
      link_preview: { window_ms: 60000, limit: 10 },
      contact_ip: { window_ms: 600000, limit: 5 },
      platform_mfa: { window_ms: 600000, limit: 10 },
    },
  ],
];

const sql = postgres(url, { max: 1 });
for (const [key, value] of settings) {
  await sql`
    INSERT INTO platform_settings (key, value)
    VALUES (${key}, ${sql.json(value)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}
await sql.end();
console.log(`seeded ${settings.length} platform_settings`);

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const src = join(root, "src");
let failed = false;

function fail(message) {
  console.error(message);
  failed = true;
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, acc);
    else acc.push(abs);
  }
  return acc;
}

const srcFiles = walk(src).filter((p) => p.endsWith(".ts") || p.endsWith(".tsx"));

for (const file of srcFiles) {
  const rel = file.slice(root.length + 1).replaceAll("\\", "/");
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes("from '@/lib/db'") || line.includes('from "@/lib/db"')) {
      if (!rel.endsWith("/repo.ts") && !rel.startsWith("src/lib/db")) {
        fail(`${rel}:${i + 1}: lib/db import 는 repo.ts 또는 src/lib/db 만 허용`);
      }
    }
    if (
      /from\s+['"]better-auth(?:\/|['"])/.test(line) &&
      !rel.startsWith("src/lib/auth")
    ) {
      fail(`${rel}:${i + 1}: better-auth 는 src/lib/auth 안에서만`);
    }
    if (
      /from\s+['"]@aws-sdk\//.test(line) &&
      !rel.startsWith("src/lib/storage")
    ) {
      fail(`${rel}:${i + 1}: @aws-sdk 는 src/lib/storage 안에서만`);
    }
    if (
      (line.includes("from 'resend'") || line.includes('from "resend"')) &&
      !rel.startsWith("src/lib/notify")
    ) {
      fail(`${rel}:${i + 1}: resend 는 src/lib/notify 안에서만`);
    }
    if (line.includes(": any")) {
      fail(`${rel}:${i + 1}: any 금지`);
    }

    // ARCHITECTURE.md 5.1 / AGENTS.md 8 — 입력 문자열을 new Date() 로 직접 파싱하지 않는다.
    // datetime-local·date 값은 타임존이 없어 서버(UTC)에서 9시간 밀린다.
    // 이 결함은 개발 환경(KST)에서 절대 드러나지 않으므로 여기서 막는다.
    if (
      /\/(actions|service)\.ts$/.test(rel) &&
      /new Date\(\s*(?!\)|Date\.now|now\b|\d)[A-Za-z_$]/.test(line) &&
      !line.includes("lib/datetime") &&
      !/\.toISOString\(\)|\.createdAt|\.updatedAt|Date\.now/.test(line)
    ) {
      fail(
        `${rel}:${i + 1}: 입력 시각은 lib/datetime 의 parseSeoulInput() 으로 변환할 것 (5.1)`,
      );
    }

    // 12.1 — try 안에서 await 없이 Promise 를 return 하면 catch 가 동작하지 않는다.
    if (/^\s*return\s+[a-zA-Z_$][\w$]*\(/.test(line) && /\/actions\.ts$/.test(rel)) {
      const prev = lines.slice(Math.max(0, i - 6), i).join("\n");
      if (/\btry\s*\{/.test(prev)) {
        fail(
          `${rel}:${i + 1}: try 블록 안에서는 await 후 반환할 것 (catch 가 동작하지 않는다)`,
        );
      }
    }
  });

  // 프로젝트 축 방어선(I11) — project_id 를 가진 테이블의 repo 는
  // scoped() 와 projectScoped() 를 함께 써야 한다.
  if (/^src\/modules\/(design|material|photo|schedule|comment|access)\/repo\.ts$/.test(rel)) {
    if (!text.includes("projectScoped(")) {
      fail(`${rel}: projectScoped() 누락 — 프로젝트 경계 방어선 2-B (I11)`);
    }
    if (!text.includes("assertSameProject(")) {
      fail(`${rel}: assertSameProject() 누락 — 프로젝트 경계 방어선 2-B (I11)`);
    }
  }
}

function findMiddleware(dir) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      const hit = findMiddleware(abs);
      if (hit) return hit;
    } else if (name.startsWith("middleware.")) {
      return abs;
    }
  }
  return null;
}

const middleware = findMiddleware(src);
if (middleware) {
  fail(`middleware 파일 금지: ${middleware}`);
}

if (failed) process.exit(1);
console.log("selfcheck passed");

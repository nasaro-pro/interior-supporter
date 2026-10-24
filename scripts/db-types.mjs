#!/usr/bin/env node
// db-types.mjs — DB 타입 생성 (Windows·macOS 공통). SUPABASE_PROJECT_REF 를 환경변수 또는 .env.local 에서 읽는다.
// 결과: src/shared/contracts/database.types.ts (제출하지 않음 — 병합 후 재생성)
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';

let ref = process.env.SUPABASE_PROJECT_REF;
if (!ref && existsSync('.env.local')) {
  ref = /^SUPABASE_PROJECT_REF=(.+)$/m.exec(readFileSync('.env.local', 'utf8'))?.[1]?.trim();
}
if (!ref) {
  console.error('.env.local 에 SUPABASE_PROJECT_REF=<내 프로젝트 ref> 를 넣으세요.');
  process.exit(2);
}
const out = execSync(`npx supabase gen types typescript --project-id ${ref}`, {
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'inherit'],
});
writeFileSync('src/shared/contracts/database.types.ts', out);
console.log('src/shared/contracts/database.types.ts 생성 완료');

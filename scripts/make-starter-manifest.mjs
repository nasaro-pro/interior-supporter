#!/usr/bin/env node
// make-starter-manifest.mjs — 스타터 기준 해시 목록 생성 (통합 책임자 전용, 스타터 배포·개정 때만)
// 사용: npm run starter:manifest -- --version 1.3
// 담당자(A·B·C)는 실행하지 않는다. 실행하면 소유권 검사 기준이 바뀌어 제출본이 거절된다.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { hashFile, listFiles, loadConfig, manifestDigest } from './lib/ownership-core.mjs';

const root = process.cwd();
const vi = process.argv.indexOf('--version');
const starterVersion = vi > 0 ? process.argv[vi + 1] : null;
if (!starterVersion) {
  console.error('사용법: npm run starter:manifest -- --version <예: 1.3>');
  process.exit(2);
}
const config = loadConfig(root);
const files = {};
for (const f of listFiles(root, config))
  if (f !== 'starter-manifest.json') files[f] = hashFile(join(root, f));
const manifest = {
  starterVersion,
  created: new Date().toISOString(),
  digest: manifestDigest(files),
  files,
};
writeFileSync(join(root, 'starter-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `starter-manifest.json — 스타터 ${starterVersion} · 파일 ${Object.keys(files).length}개 · digest ${manifest.digest}`,
);

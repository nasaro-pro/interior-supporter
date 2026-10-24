#!/usr/bin/env node
// check-ownership.mjs — 담당 경로 소유권 검사 (Git 없음, 00 헌법 3장·12장)
// 사용: npm run check:ownership -- --owner B      (또는 OWNER=B)
// 기준: starter-manifest.json (스타터 원본 해시). 종료 코드 0 = 위반 없음 · 1 = 위반 · 2 = 사용법 오류
import process from 'node:process';
import { analyze, LABEL, parseOwner } from './lib/ownership-core.mjs';

const { owner } = parseOwner(process.argv.slice(2));
if (!owner) {
  console.error('사용법: npm run check:ownership -- --owner <A|B|C>');
  process.exit(2);
}

let result;
try {
  result = analyze(process.cwd(), owner);
} catch (e) {
  console.error(`오류: ${e.message}`);
  process.exit(2);
}
const { manifest, items } = result;
const by = (k) => items.filter((i) => i.kind === k);
console.log(
  `[check-ownership] 담당 ${owner} · 스타터 ${manifest.starterVersion} (${manifest.digest}) · 변경 ${items.length}개`,
);
for (const k of ['own', 'stub', 'shadcn', 'frozen', 'foreign']) {
  const list = by(k);
  if (!list.length) continue;
  console.log(`\n■ ${LABEL[k]} — ${list.length}개`);
  for (const i of list) {
    const who = i.owners.length ? ` (소유: ${i.owners.join(',')})` : '';
    console.log(`  ${i.change.padEnd(8)} ${i.file}${k === 'foreign' ? who : ''}`);
  }
}
const bad = [...by('frozen'), ...by('foreign')];
if (bad.length) {
  console.log(
    `\n[check-ownership] 위반 ${bad.length}건 — 되돌리거나(스타터 원본으로 복사), STUB 이면 첫 줄에 "// STUB(${owner}): ..." 를 넣고, 공통 파일 변경이 필요하면 progress/${owner}.md 의 CR 로 적으세요.`,
  );
  process.exit(1);
}
console.log('\n[check-ownership] 위반 0건');

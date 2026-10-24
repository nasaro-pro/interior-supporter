#!/usr/bin/env node
// merge-submissions.mjs — 통합 책임자 전용: 새 스타터 복사본에 A·B·C 제출본을 합친다 (00 헌법 13장)
// 사용: (새로 복사한 스타터 폴더에서) npm run merge:submissions -- <A제출폴더> <B제출폴더> <C제출폴더>
// 옵션: --dry-run (복사하지 않고 검사만) · --allow-starter-mismatch (스타터 버전이 달라도 진행)
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import {
  globToRegExp,
  hashFile,
  loadConfig,
  loadManifest,
  matchesAny,
} from './lib/ownership-core.mjs';

const root = process.cwd();
const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const allowMismatch = args.includes('--allow-starter-mismatch');
const dirs = args.filter((a) => !a.startsWith('--')).map((a) => resolve(a));
if (!dirs.length) {
  console.error('사용법: npm run merge:submissions -- <제출폴더...> [--dry-run]');
  process.exit(2);
}
const config = loadConfig(root);
const manifest = loadManifest(root);
const frozen = config.frozen.map(globToRegExp);
const subs = dirs
  .map((dir) => ({ dir, s: JSON.parse(readFileSync(join(dir, 'SUBMISSION.json'), 'utf8')) }))
  .sort((a, b) => a.s.owner.localeCompare(b.s.owner)); // 순서 A → B → C

const report = [
  `# 병합 보고 — ${new Date().toISOString()}`,
  '',
  `스타터 ${manifest.starterVersion} (${manifest.digest})`,
  '',
];
const errors = [];
const claimed = new Map();
for (const { dir, s } of subs) {
  const res = config[s.owner].map(globToRegExp);
  report.push(`## ${s.owner} ${s.name} — 스타터 ${s.starterVersion} (${s.starterDigest})`);
  if (s.starterDigest !== manifest.digest) {
    (allowMismatch ? report : errors).push(
      `- ${s.owner}: 스타터 버전 불일치 (${s.starterDigest} ≠ ${manifest.digest})`,
    );
  }
  for (const f of [...s.files.added, ...s.files.modified, ...s.files.deleted]) {
    if (!matchesAny(f, res)) errors.push(`- ${s.owner}: 소유 경로 밖 파일 ${f}`);
    if (manifest.files[f] && matchesAny(f, frozen))
      errors.push(`- ${s.owner}: 스타터 고정 파일 ${f}`);
    if (claimed.has(f)) errors.push(`- 충돌: ${f} (${claimed.get(f)} 와 ${s.owner})`);
    claimed.set(f, s.owner);
  }
  report.push(
    `- 추가 ${s.files.added.length} · 수정 ${s.files.modified.length} · 삭제 ${s.files.deleted.length} · STUB 폐기 ${s.stubs.length} · shadcn ${s.shadcn.length}`,
  );
}
if (errors.length) {
  console.error(
    ['병합 중단 — 아래를 해당 담당에게 반려하거나 고친 뒤 다시 실행:', ...errors].join('\n'),
  );
  process.exit(1);
}
const shadcnNotes = [];
if (!dry) {
  for (const { dir, s } of subs) {
    for (const f of [...s.files.added, ...s.files.modified]) {
      mkdirSync(dirname(join(root, f)), { recursive: true });
      copyFileSync(join(dir, 'files', f), join(root, f));
    }
    for (const f of s.files.deleted) rmSync(join(root, f), { force: true });
    for (const f of s.shadcn) {
      const dst = join(root, f);
      if (!existsSync(dst)) {
        mkdirSync(dirname(dst), { recursive: true });
        copyFileSync(join(dir, 'shadcn', f), dst);
        shadcnNotes.push(`- ${f} ← ${s.owner}`);
      } else if (hashFile(dst) !== hashFile(join(dir, 'shadcn', f))) {
        shadcnNotes.push(`- ${f}: 기존 파일 유지 (${s.owner} 것과 다름 — 확인 필요)`);
      }
    }
  }
}
report.push('', '## shadcn 생성 파일', shadcnNotes.length ? shadcnNotes.join('\n') : '- 변경 없음');
report.push(
  '',
  '## 다음 단계 (00 헌법 13.3)',
  '1. npm install → npm run db:types',
  '2. npm run check · npm run db:test',
  '3. 각 progress/<담당>.md 의 CR 검토·반영',
  '4. INT-01~10 · TC-990 · 점수·G 판정 (00 헌법 14장)',
);
mkdirSync(join(root, '_submit'), { recursive: true });
writeFileSync(join(root, '_submit', 'MERGE_REPORT.md'), `${report.join('\n')}\n`);
console.log(report.join('\n'));
console.log(`\n${dry ? '[dry-run] 복사하지 않았습니다. ' : ''}보고서: _submit/MERGE_REPORT.md`);

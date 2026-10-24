#!/usr/bin/env node
// export-submission.mjs — 제출본 만들기 (Git 없음, 00 헌법 12장)
// 사용: npm run submit -- --owner B
// 결과: _submit/<담당>_<이름>_<날짜-시각>/ 폴더 → 이 폴더를 ZIP 으로 압축해 통합 책임자에게 전달한다.
//   files/      내 경로의 추가·수정 파일 (원래 경로 그대로)
//   shadcn/     내가 CLI 로 추가한 shadcn 생성 파일 (참고용, 통합 시 A 것 우선)
//   SUBMISSION.json / SUBMISSION.md   기계용·사람용 목록
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { analyze, parseOwner } from './lib/ownership-core.mjs';

const root = process.cwd();
const { owner } = parseOwner(process.argv.slice(2));
if (!owner) {
  console.error('사용법: npm run submit -- --owner <A|B|C>');
  process.exit(2);
}
let result;
try {
  result = analyze(root, owner);
} catch (e) {
  console.error(`오류: ${e.message}`);
  process.exit(2);
}
const { config, manifest, items } = result;
const bad = items.filter((i) => i.kind === 'frozen' || i.kind === 'foreign');
if (bad.length) {
  console.error(
    `위반 ${bad.length}건이 있어 제출본을 만들지 않습니다. 먼저 npm run check:ownership -- --owner ${owner} 로 확인해 고치세요.`,
  );
  for (const i of bad) console.error(`  ${i.change} ${i.file}`);
  process.exit(1);
}
if (!existsSync(join(root, `progress/${owner}.md`))) {
  console.error(
    `progress/${owner}.md 진행 기록이 없습니다. 00 헌법 부록 B 양식으로 작성한 뒤 다시 실행하세요.`,
  );
  process.exit(1);
}

const name = config.members?.[owner] ?? '';
const d = new Date();
const p2 = (n) => String(n).padStart(2, '0');
const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}`;
const out = join(root, '_submit', `${owner}_${name}_${stamp}`);

const own = items.filter((i) => i.kind === 'own');
const shadcn = items.filter((i) => i.kind === 'shadcn');
const stubs = items.filter((i) => i.kind === 'stub');
const copy = (file, sub) => {
  const dst = join(out, sub, file);
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(join(root, file), dst);
};
for (const i of own) if (i.change !== 'deleted') copy(i.file, 'files');
for (const i of shadcn) copy(i.file, 'shadcn');

const pick = (c) => own.filter((i) => i.change === c).map((i) => i.file);
const summary = {
  owner,
  name,
  createdAt: d.toISOString(),
  starterVersion: manifest.starterVersion,
  starterDigest: manifest.digest,
  files: { added: pick('added'), modified: pick('modified'), deleted: pick('deleted') },
  shadcn: shadcn.map((i) => i.file),
  stubs: stubs.map((i) => i.file),
};
writeFileSync(join(out, 'SUBMISSION.json'), `${JSON.stringify(summary, null, 2)}\n`);
const list = (arr) => (arr.length ? arr.map((f) => `- \`${f}\``).join('\n') : '- 없음');
writeFileSync(
  join(out, 'SUBMISSION.md'),
  `# 제출본 — ${owner} ${name}

- 만든 시각: ${d.toISOString()}
- 스타터: ${manifest.starterVersion} (digest ${manifest.digest})
- 진행 기록: files/progress/${owner}.md

## 추가한 파일 (${summary.files.added.length})
${list(summary.files.added)}

## 수정한 파일 (${summary.files.modified.length})
${list(summary.files.modified)}

## 삭제한 파일 (${summary.files.deleted.length})
${list(summary.files.deleted)}

## shadcn 생성 파일 (참고용)
${list(summary.shadcn)}

## STUB (제출에서 제외됨 — 병합 시 진짜 구현으로 대체)
${list(summary.stubs)}

## 제출 전 확인 (00 헌법 12.3)
- [ ] npm run check 통과
- [ ] npm run db:test 통과
- [ ] npm run check:ownership -- --owner ${owner} 위반 0건
- [ ] progress/${owner}.md 최신 (평가 기록 포함)
- [ ] .env.local·비밀값이 이 폴더에 없음
`,
);
console.log(`제출본: ${out}`);
console.log(`  내 파일 ${own.length}개 · shadcn ${shadcn.length}개 · STUB 제외 ${stubs.length}개`);
console.log(
  '다음: 이 폴더를 ZIP 으로 압축해 통합 책임자에게 전달하세요 (탐색기에서 폴더 우클릭 → 압축).',
);

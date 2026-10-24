#!/usr/bin/env node
// check-messages.mjs — messages/ko 와 messages/en 의 파일·키 집합이 같은지 검사 (00 헌법 10.4)
import { readdirSync, readFileSync } from 'node:fs';
import process from 'node:process';

const keys = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
const load = (loc) =>
  Object.fromEntries(
    readdirSync(`messages/${loc}`)
      .filter((f) => f.endsWith('.json'))
      .map((f) => [f, new Set(keys(JSON.parse(readFileSync(`messages/${loc}/${f}`, 'utf8'))))]),
  );
const ko = load('ko');
const en = load('en');
const problems = [];
for (const f of new Set([...Object.keys(ko), ...Object.keys(en)])) {
  if (!ko[f] || !en[f]) {
    problems.push(`${f}: ${ko[f] ? 'en' : 'ko'} 파일 없음`);
    continue;
  }
  for (const k of ko[f]) if (!en[f].has(k)) problems.push(`${f}: en 에 없는 키 ${k}`);
  for (const k of en[f]) if (!ko[f].has(k)) problems.push(`${f}: ko 에 없는 키 ${k}`);
}
if (problems.length) {
  console.error(`[check-messages] 불일치 ${problems.length}건\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('[check-messages] ko·en 키 집합 일치');

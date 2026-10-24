// scripts/lib/ownership-core.mjs — 로컬(무 Git) 소유권 판정 공통 모듈 (00 헌법 3장·12장)
// 소유: 통합 책임자(스타터 고정 파일) · Node 24 · 외부 의존성 없음
// 기준: starter-manifest.json (스타터의 모든 파일 경로 → SHA-256). Git·GitHub 를 쓰지 않는다.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const OWNERS = ['A', 'B', 'C'];

/** glob → RegExp. `**` 와 `*` 만 특수 문자 ([company] 같은 대괄호는 글자 그대로) */
export function globToRegExp(glob) {
  let re = '^';
  for (let i = 0; i < glob.length;) {
    if (glob.startsWith('**/', i)) {
      re += '(?:.*/)?';
      i += 3;
    } else if (glob.startsWith('**', i)) {
      re += '.*';
      i += 2;
    } else if (glob[i] === '*') {
      re += '[^/]*';
      i += 1;
    } else {
      re += glob[i].replace(/[.+?^${}()|[\]\\]/g, '\\$&');
      i += 1;
    }
  }
  return new RegExp(`${re}$`);
}

export const matchesAny = (file, regexps) => regexps.some((re) => re.test(file));

export function loadConfig(root) {
  const config = JSON.parse(readFileSync(join(root, 'ownership.json'), 'utf8'));
  for (const key of [...OWNERS, 'frozen', 'shadcn_generated', 'ignore']) {
    if (!Array.isArray(config[key])) throw new Error(`ownership.json 에 "${key}" 배열이 없습니다`);
  }
  return config;
}

/** 줄바꿈(CRLF/LF) 차이는 같은 파일로 본다 — Windows 편집기 대비 */
export function hashFile(path) {
  const buf = readFileSync(path);
  const isBinary = buf.subarray(0, 8000).includes(0);
  const data = isBinary ? buf : Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
  return createHash('sha256').update(data).digest('hex');
}

export function isIgnored(file, ignoreRes) {
  if (file === '.env.example') return false;
  if (file === '.env' || file.startsWith('.env.')) return true;
  return matchesAny(file, ignoreRes);
}

/** 프로젝트의 모든 파일(무시 목록 제외)을 '/' 구분 상대 경로로 */
export function listFiles(root, config) {
  const ignoreRes = config.ignore.map(globToRegExp);
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      const rel = relative(root, abs).split(sep).join('/');
      const st = statSync(abs);
      if (st.isDirectory()) {
        if (isIgnored(`${rel}/`, ignoreRes) || isIgnored(`${rel}/x`, ignoreRes)) continue;
        walk(abs);
      } else if (st.isFile() && !isIgnored(rel, ignoreRes)) {
        out.push(rel);
      }
    }
  };
  walk(root);
  return out.sort();
}

export function manifestDigest(files) {
  const h = createHash('sha256');
  for (const k of Object.keys(files).sort()) h.update(`${k}\0${files[k]}\n`);
  return h.digest('hex').slice(0, 16);
}

export function loadManifest(root) {
  const p = join(root, 'starter-manifest.json');
  if (!existsSync(p))
    throw new Error(
      'starter-manifest.json 이 없습니다. 스타터 폴더를 통째로 복사했는지 확인하세요.',
    );
  return JSON.parse(readFileSync(p, 'utf8'));
}

const firstLine = (path) => readFileSync(path, 'utf8').split(/\r?\n/, 1)[0] ?? '';

/**
 * 스타터 대비 변경 파일을 분류한다.
 * 결과 항목: { file, change: 'added'|'modified'|'deleted', kind: 'own'|'stub'|'shadcn'|'frozen'|'foreign' , owners }
 */
export function analyze(root, owner) {
  const config = loadConfig(root);
  const manifest = loadManifest(root);
  const res = Object.fromEntries(OWNERS.map((o) => [o, config[o].map(globToRegExp)]));
  const frozen = config.frozen.map(globToRegExp);
  const shadcn = config.shadcn_generated.map(globToRegExp);
  const current = listFiles(root, config).filter((f) => f !== 'starter-manifest.json');
  const base = manifest.files;
  const items = [];
  const seen = new Set();
  for (const file of current) {
    seen.add(file);
    let change = null;
    if (!(file in base)) change = 'added';
    else if (hashFile(join(root, file)) !== base[file]) change = 'modified';
    if (change) items.push({ file, change });
  }
  for (const file of Object.keys(base))
    if (!seen.has(file)) items.push({ file, change: 'deleted' });

  for (const it of items) {
    it.owners = OWNERS.filter((o) => matchesAny(it.file, res[o]));
    const own = matchesAny(it.file, res[owner]);
    if (it.change !== 'added' && matchesAny(it.file, frozen)) it.kind = 'frozen';
    else if (own) it.kind = 'own';
    else if (it.change === 'added' && matchesAny(it.file, shadcn)) it.kind = 'shadcn';
    else if (it.change !== 'deleted' && /STUB\([ABC]\)/.test(firstLine(join(root, it.file))))
      it.kind = 'stub';
    else it.kind = 'foreign';
  }
  return { config, manifest, items };
}

export function parseOwner(argv) {
  let owner = process.env.OWNER;
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--owner') owner = argv[++i];
    else if (a.startsWith('--owner=')) owner = a.slice(8);
    else rest.push(a);
  }
  owner = String(owner ?? '')
    .trim()
    .toUpperCase();
  return { owner: OWNERS.includes(owner) ? owner : null, rest };
}

export const LABEL = {
  own: '내 경로',
  stub: 'STUB(제출 제외·병합 시 폐기)',
  shadcn: 'shadcn 생성 파일(제출 시 목록만 전달)',
  frozen: '스타터 고정 파일 수정·삭제 (위반)',
  foreign: '남의 경로 (위반)',
};

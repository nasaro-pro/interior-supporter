// 바닥 칸 SNS 주소 — 붙여넣은 주소에서 종류를 알아보고 https 로 정리 (DB check private.valid_sns_links 와 같은 규칙: https, 최대 5개, 300자)
export const SNS_KINDS = ['instagram', 'youtube', 'blog', 'kakao', 'web'] as const;
export type SnsKind = (typeof SNS_KINDS)[number];
export const SNS_MAX = 5;

const PATTERNS: [Exclude<SnsKind, 'web'>, RegExp][] = [
  ['instagram', /^https:\/\/(www\.)?instagram\.com\/[\w.]+\/?(\?.*)?$/i],
  [
    'youtube',
    /^https:\/\/(www\.|m\.)?(youtube\.com\/(@|channel\/|c\/)[\w.-]+|youtu\.be\/[\w-]+)\/?(\?.*)?$/i,
  ],
  ['blog', /^https:\/\/(m\.)?blog\.naver\.com\/[\w-]+\/?(\?.*)?$/i],
  ['kakao', /^https:\/\/pf\.kakao\.com\/[\w-]+\/?(\?.*)?$/i],
];
const KNOWN_HOSTS = /(^|\.)(instagram\.com|youtube\.com|youtu\.be|blog\.naver\.com|kakao\.com)$/i;

export type SnsCheck =
  | { ok: true; kind: SnsKind; url: string }
  | { ok: false; error: 'insecure' | 'invalid' | 'tooLong' };

/** 'instagram.com/아이디' 처럼 https:// 없이 붙여넣어도 받는다. http:// 는 거절 */
export function checkSns(raw: string): SnsCheck {
  let u = raw.trim();
  if (/^http:\/\//i.test(u)) return { ok: false, error: 'insecure' };
  if (!/^https:\/\//i.test(u)) u = `https://${u.replace(/^\/+/, '')}`;
  if (u.length > 300) return { ok: false, error: 'tooLong' };
  if (/\s/.test(u)) return { ok: false, error: 'invalid' };
  let host: string;
  try {
    host = new URL(u).hostname;
  } catch {
    return { ok: false, error: 'invalid' };
  }
  for (const [kind, re] of PATTERNS) if (re.test(u)) return { ok: true, kind, url: u };
  // 알려진 SNS 인데 계정 주소 모양이 아니면 (예: instagram.com 만) 거절
  if (KNOWN_HOSTS.test(host)) return { ok: false, error: 'invalid' };
  if (!/\.[a-z]{2,}$/i.test(host)) return { ok: false, error: 'invalid' };
  return { ok: true, kind: 'web', url: u };
}

/** 저장 전 정리: 빈 칸 빼고, 같은 주소 한 번만, 최대 5개 */
export function cleanSnsList(list: string[]): string[] {
  const out: string[] = [];
  for (const raw of list) {
    if (!raw.trim()) continue;
    const r = checkSns(raw);
    if (r.ok && !out.includes(r.url)) out.push(r.url);
  }
  return out.slice(0, SNS_MAX);
}

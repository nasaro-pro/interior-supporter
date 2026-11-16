// 업체가 고치는 공개 페이지 작은 문구 (DB company_portfolios.page_labels, 20261108000900)
//  값: 글자 = 직접 쓴 문구 / false = 숨김 / 없음 = 기본 문구(번역 파일)
//  '시공 사례' 제목(worksTitle)은 숨길 수 없다 — 화면 읽기 프로그램이 이 구역을 찾는 제목이라서
export const LABEL_KEYS = [
  'introKicker',
  'worksKicker',
  'worksTitle',
  'followUs',
  'contact',
] as const;
export type LabelKey = (typeof LABEL_KEYS)[number];
export type PageLabels = Partial<Record<LabelKey, string | false>>;

export const LABEL_MAX: Record<LabelKey, number> = {
  introKicker: 30,
  worksKicker: 30,
  worksTitle: 20,
  followUs: 30,
  contact: 30,
};
export const canHide = (k: LabelKey) => k !== 'worksTitle';

/** DB·폼 값 정리: 모르는 칸·빈 글·너무 긴 글·숨길 수 없는 칸의 false 는 버린다 (= 기본 문구) */
export function cleanLabels(raw: unknown): PageLabels {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: PageLabels = {};
  for (const k of LABEL_KEYS) {
    const v = (raw as Record<string, unknown>)[k];
    if (v === false && canHide(k)) out[k] = false;
    else if (typeof v === 'string') {
      const s = v.trim();
      if (s && [...s].length <= LABEL_MAX[k]) out[k] = s;
    }
  }
  return out;
}

/** 보여 줄 문구. null = 숨김 */
export function labelText(
  labels: PageLabels | undefined,
  key: LabelKey,
  fallback: string,
): string | null {
  const v = labels?.[key];
  if (v === false) return canHide(key) ? null : fallback;
  return v ? v : fallback;
}

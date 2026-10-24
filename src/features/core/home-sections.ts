// src/features/core/home-sections.ts (A · REQ-014·016) — 고객 홈 4영역 순서·표시 (POL-026, DB CHECK valid_home_sections)
import {
  HOME_SECTION_KEYS,
  type HomeSectionKey,
  type HomeSections,
} from '@/shared/contracts/domain';

export const DEFAULT_HOME_SECTIONS: HomeSections = HOME_SECTION_KEYS.map((key) => ({
  key,
  visible: true,
}));

/** DB jsonb → 4키 순열 보장 (빠진 키는 뒤에 표시 상태로 채움) */
export function normalizeHomeSections(raw: unknown): HomeSections {
  if (!Array.isArray(raw)) return DEFAULT_HOME_SECTIONS;
  const seen = new Set<HomeSectionKey>();
  const out: HomeSections = [];
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue;
    const key = (e as { key?: unknown }).key;
    const visible = (e as { visible?: unknown }).visible;
    if (typeof key === 'string' && (HOME_SECTION_KEYS as readonly string[]).includes(key)) {
      const k = key as HomeSectionKey;
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ key: k, visible: visible !== false });
      }
    }
  }
  for (const key of HOME_SECTION_KEYS) if (!seen.has(key)) out.push({ key, visible: true });
  return out;
}

/** index 의 영역을 위(-1)/아래(+1)로 이동 */
export function moveSection(sections: HomeSections, index: number, dir: -1 | 1): HomeSections {
  const target = index + dir;
  if (target < 0 || target >= sections.length) return sections;
  const next = [...sections];
  const a = next[index];
  const b = next[target];
  if (!a || !b) return sections;
  next[index] = b;
  next[target] = a;
  return next;
}

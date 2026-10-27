// D-26~D-28 도안 순서 규칙 (순수 함수) — 목록 표시와 순서 저장이 같은 규칙을 쓴다
// - 정렬 기준: sort_order → 최근 수정 → id (DB 조회 순서)
// - 공간 묶음 순서: 그 공간 도안 중 가장 앞선 것의 순서 (공간 순서 이동 = 묶음을 통째로 옮김)
// - 묶음 안: 대표 도안이 맨 앞, 나머지는 순서대로
import type { MaterialSpace } from '@/shared/contracts/domain';

export type Space = MaterialSpace | null;
export interface Orderable {
  id: string;
  space: Space;
  isMain: boolean;
}
export interface SpaceGroup<T extends Orderable> {
  space: Space;
  items: T[];
}

/** 이미 정렬 기준대로 놓인 목록을 공간별로 묶는다 (묶음 순서 = 첫 등장 순서) */
export function groupBySpace<T extends Orderable>(items: T[]): SpaceGroup<T>[] {
  const groups: SpaceGroup<T>[] = [];
  for (const d of items) {
    const g = groups.find((x) => x.space === d.space);
    if (g) g.items.push(d);
    else groups.push({ space: d.space, items: [d] });
  }
  for (const g of groups) {
    const i = g.items.findIndex((d) => d.isMain);
    if (i > 0) g.items.unshift(...g.items.splice(i, 1));
  }
  return groups;
}

/** 묶음을 펼쳐 저장할 id 순서로 */
export const flattenIds = <T extends Orderable>(groups: SpaceGroup<T>[]) =>
  groups.flatMap((g) => g.items.map((d) => d.id));

function swap<T>(list: T[], i: number, j: number) {
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/**
 * 도안 한 칸 이동 — 같은 공간 안에서만 움직인다.
 * 결과: 'missing'(목록에 없음) · 'edge'(이미 끝) · 새 id 순서
 */
export function moveWithinSpace<T extends Orderable>(
  groups: SpaceGroup<T>[],
  id: string,
  direction: 'up' | 'down',
): string[] | 'missing' | 'edge' {
  const gi = groups.findIndex((g) => g.items.some((d) => d.id === id));
  if (gi < 0) return 'missing';
  const items = groups[gi]!.items;
  const i = items.findIndex((d) => d.id === id);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= items.length) return 'edge';
  const next = groups.map((g, k) => (k === gi ? { ...g, items: swap(items, i, j) } : g));
  return flattenIds(next);
}

/** 공간 묶음 한 칸 이동 */
export function moveSpace<T extends Orderable>(
  groups: SpaceGroup<T>[],
  space: Space,
  direction: 'up' | 'down',
): string[] | 'missing' | 'edge' {
  const i = groups.findIndex((g) => g.space === space);
  if (i < 0) return 'missing';
  const j = direction === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= groups.length) return 'edge';
  return flattenIds(swap(groups, i, j));
}

/** CU-03 고객 도안 첫 화면에 크게 보일 도안 */
export interface HeroCandidate extends Orderable {
  previewFileId: string | null;
  updatedAt: string;
}
/**
 * 대표 도안(비교 이미지 있음) → 없으면 이미지가 있는 최근 공개 도안 → 그것도 없으면 null.
 * 고객 목록은 RLS 가 공개분만 주므로, 비공개 대표 도안은 처음부터 후보가 아니다.
 */
export function pickHero<T extends HeroCandidate>(items: T[]): T | null {
  const main = items.find((d) => d.isMain && d.previewFileId);
  if (main) return main;
  const withImage = items.filter((d) => d.previewFileId);
  if (withImage.length === 0) return null;
  return withImage.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a));
}

/** ?space= 값 → 공간 (all = 전체 보기, 그 밖 모르는 값은 null = 대표 화면) */
export function parseSpaceParam(
  raw: string | undefined,
  spaces: readonly string[],
): { mode: 'hero' } | { mode: 'all' } | { mode: 'space'; space: Space } {
  if (raw === undefined || raw === '') return { mode: 'hero' };
  if (raw === 'all') return { mode: 'all' };
  if (raw === 'whole') return { mode: 'space', space: null };
  if (spaces.includes(raw)) return { mode: 'space', space: raw as Space };
  return { mode: 'hero' };
}

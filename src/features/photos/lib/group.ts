// 촬영일 기준 묶음 (REQ-210) — 쿼리 정렬(촬영일 desc, nulls last)을 그대로 유지. 순수 함수.
import type { PhotoItem } from '../types';

export function groupPhotosByDate(
  items: PhotoItem[],
): { date: string | null; items: PhotoItem[] }[] {
  const groups: { date: string | null; items: PhotoItem[] }[] = [];
  const index = new Map<string | null, number>();
  for (const item of items) {
    const key = item.capturedOn;
    let at = index.get(key);
    if (at === undefined) {
      at = groups.length;
      index.set(key, at);
      groups.push({ date: key, items: [] });
    }
    groups[at]!.items.push(item);
  }
  // 촬영일 없음은 항상 마지막
  return [...groups.filter((g) => g.date !== null), ...groups.filter((g) => g.date === null)];
}

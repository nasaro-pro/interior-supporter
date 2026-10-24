// 사진 목록 query 해석 — 공정·촬영일 범위·업로더 독립 필터 (REQ-210). 순수 함수.
import {
  firstParam,
  isUuid,
  parseListSize,
  type SearchParams,
} from '@/features/requests/lib/list-params';
import { PAGE_SIZE, PHOTO_PHASES, type PhotoPhase } from '@/shared/contracts/domain';
import type { ProjectAccess } from '@/shared/contracts/integration';
import { ymdSchema } from '../schema';
import type { PhotoListFilters } from '../types';

const ymdOrNull = (v: string | undefined) => (ymdSchema.safeParse(v).success ? v! : null);

export function parsePhotoListParams(sp: SearchParams, as: ProjectAccess['as']): PhotoListFilters {
  const p = firstParam(sp, 'phase');
  const phase = (PHOTO_PHASES as readonly string[]).includes(p ?? '') ? (p as PhotoPhase) : null;
  let from = ymdOrNull(firstParam(sp, 'from'));
  let to = ymdOrNull(firstParam(sp, 'to'));
  if (from && to && from > to) [from, to] = [to, from];
  const u = firstParam(sp, 'uploader');
  return {
    phase,
    from,
    to,
    uploader: isUuid(u) ? u : null,
    archived: as === 'editor' && firstParam(sp, 'archived') === '1', // POL-020
    size: parseListSize(firstParam(sp, 'size')),
  };
}

export const hasPhotoFilter = (f: PhotoListFilters) =>
  f.phase !== null || f.from !== null || f.to !== null || f.uploader !== null;

/** 현재 필터에 patch 를 덮어쓴 주소. extra 는 앞에 고정(시공팀 ?project=) */
export function photoListHref(
  base: string,
  current: PhotoListFilters,
  patch: Partial<PhotoListFilters>,
  extra: Record<string, string> = {},
): string {
  const f = { ...current, ...patch };
  const s = new URLSearchParams(extra);
  if (f.phase) s.set('phase', f.phase);
  if (f.from) s.set('from', f.from);
  if (f.to) s.set('to', f.to);
  if (f.uploader) s.set('uploader', f.uploader);
  if (f.archived) s.set('archived', '1');
  if (f.size !== PAGE_SIZE) s.set('size', String(f.size));
  const qs = s.toString();
  return qs ? `${base}?${qs}` : base;
}

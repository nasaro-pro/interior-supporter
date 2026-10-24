// 일정 화면 상태 query — ?view=month|timeline&month=YYYY-MM&day=YYYY-MM-DD (화면 상태, 뎁스 아님). 순수 함수.
import { firstParam, type SearchParams } from '@/features/requests/lib/list-params';
import { ymdSchema } from '@/features/photos';
import type { ProjectAccess } from '@/shared/contracts/integration';
import { parseMonthParam } from './calendar';

export interface ScheduleViewState {
  view: 'month' | 'timeline';
  month: string;
  monthInvalid: boolean;
  day: string | null;
  archived: boolean;
}

export function parseScheduleView(
  sp: SearchParams,
  today: string,
  as: ProjectAccess['as'],
): ScheduleViewState {
  const d = firstParam(sp, 'day');
  const day = d && ymdSchema.safeParse(d).success ? d : null;
  const rawMonth = firstParam(sp, 'month');
  const { month, invalid } = parseMonthParam(rawMonth ?? day?.slice(0, 7), today);
  return {
    view: firstParam(sp, 'view') === 'timeline' ? 'timeline' : 'month',
    month,
    monthInvalid: invalid,
    day,
    archived: as === 'editor' && firstParam(sp, 'archived') === '1', // POL-020
  };
}

export function scheduleHref(
  base: string,
  state: Omit<ScheduleViewState, 'monthInvalid'>,
  extra: Record<string, string> = {},
): string {
  const s = new URLSearchParams(extra);
  if (state.view === 'timeline') s.set('view', 'timeline');
  s.set('month', state.month);
  if (state.day) s.set('day', state.day);
  if (state.archived) s.set('archived', '1');
  return `${base}?${s.toString()}`;
}

/** PM-30 프로젝트 필터 — ?projects=a,b (또는 반복 값). 편집 가능한 프로젝트 밖의 id 는 버린다 */
export function parseProjectFilter(sp: SearchParams, editableIds: string[]): string[] {
  const raw = sp.projects;
  const values = (Array.isArray(raw) ? raw : raw ? [raw] : []).flatMap((v) => v.split(','));
  const allowed = new Set(editableIds);
  return [...new Set(values.map((v) => v.trim()).filter((v) => allowed.has(v)))];
}

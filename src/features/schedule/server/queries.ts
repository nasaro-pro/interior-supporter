// schedule 조회 (CT07: PM-08·PM-30·홈 공통) — 원본은 schedule_events 하나. 권한은 RLS(row_visible_schedule_events)
import 'server-only';
import type { AccessContext } from '@/shared/contracts/integration';
import { todayKst } from '@/shared/lib/dates';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { weekDays } from '../lib/calendar';
import type { RelatedType, ScheduleProgress } from '../schema';
import type { ScheduleEvent } from '../types';

const COLUMNS =
  'id, project_id, title, description, start_date, start_time, end_date, end_time, is_public, progress, related_type, related_id, archived_at, version, created_at';

interface EventRow {
  id: string;
  project_id: string;
  title: string;
  description: string;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  is_public: boolean;
  progress: string;
  related_type: string | null;
  related_id: string | null;
  archived_at: string | null;
  version: number;
  created_at: string;
}

/** DB time('HH:MM:SS') → 'HH:MM' */
const hm = (v: string | null) => (v ? v.slice(0, 5) : null);

function toEvent(r: EventRow): ScheduleEvent {
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    description: r.description,
    startDate: r.start_date,
    startTime: hm(r.start_time),
    endDate: r.end_date,
    endTime: hm(r.end_time),
    isPublic: r.is_public,
    progress: r.progress as ScheduleProgress,
    relatedType: (r.related_type as RelatedType | null) ?? null,
    relatedId: r.related_id,
    archived: r.archived_at !== null,
    version: r.version,
    createdAt: r.created_at,
  };
}

export interface EventQueryOptions {
  archived: boolean;
  /** 고객 화면: 공개 일정만 (POL-004 이중 검증, RLS 와 같은 조건) */
  publicOnly: boolean;
}

/** 기간(from~to, 양 끝 포함)과 겹치는 일정 — 시작일·시작 시각 순 */
export async function listEventsInRange(
  projectIds: string[],
  from: string,
  to: string,
  opts: EventQueryOptions,
): Promise<ScheduleEvent[]> {
  if (projectIds.length === 0) return [];
  const supabase = await createServerSupabase();
  let query = supabase
    .from('schedule_events')
    .select(COLUMNS)
    .in('project_id', projectIds)
    .lte('start_date', to)
    // from·to 는 검증된 YYYY-MM-DD 값만 들어온다
    .or(`end_date.gte.${from},and(end_date.is.null,start_date.gte.${from})`);
  if (opts.publicOnly) query = query.eq('is_public', true);
  query = opts.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
  const { data, error } = await query
    .order('start_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: true })
    .limit(1000);
  if (error) throw new Error(`schedule.range:${error.code ?? 'unknown'}`);
  return ((data ?? []) as EventRow[]).map(toEvent);
}

/** 타임라인용 — 프로젝트 전체 일정, 시작일순 */
export async function listProjectEvents(
  projectId: string,
  opts: EventQueryOptions,
): Promise<ScheduleEvent[]> {
  const supabase = await createServerSupabase();
  let query = supabase.from('schedule_events').select(COLUMNS).eq('project_id', projectId);
  if (opts.publicOnly) query = query.eq('is_public', true);
  query = opts.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
  const { data, error } = await query
    .order('start_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: true })
    .limit(500);
  if (error) throw new Error(`schedule.project:${error.code ?? 'unknown'}`);
  return ((data ?? []) as EventRow[]).map(toEvent);
}

/** PM-18 / CL-18 — 볼 수 없으면 null */
export async function getScheduleEvent(
  projectId: string,
  eventId: string,
): Promise<ScheduleEvent | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('schedule_events')
    .select(COLUMNS)
    .eq('id', eventId)
    .eq('project_id', projectId)
    .maybeSingle();
  return data ? toEvent(data as EventRow) : null;
}

export async function getProjectPeriod(
  projectId: string,
): Promise<{ name: string; startDate: string | null; endDate: string | null } | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('projects')
    .select('name, start_date, end_date')
    .eq('id', projectId)
    .maybeSingle();
  return data ? { name: data.name, startDate: data.start_date, endDate: data.end_date } : null;
}

/**
 * PM-30: 편집 가능한 프로젝트 (REQ-233). owner/manager = 업체의 보관 안 된 프로젝트 전체,
 * pm = 유효 pm 참여 프로젝트만 (POL-003). 조회는 사용자 권한(RLS)으로 한다.
 */
export async function listEditableProjects(
  ctx: AccessContext,
  companyId: string,
): Promise<{ id: string; name: string }[]> {
  const member = ctx.memberships.find((m) => m.companyId === companyId);
  if (!member) return [];
  const supabase = await createServerSupabase();
  let query = supabase
    .from('projects')
    .select('id, name')
    .eq('company_id', companyId)
    .is('archived_at', null);
  if (member.role === 'pm') {
    const ids = ctx.participations
      .filter((p) => p.role === 'pm' && p.companyId === companyId)
      .map((p) => p.projectId);
    if (ids.length === 0) return [];
    query = query.in('id', ids);
  }
  const { data } = await query.order('name', { ascending: true }).limit(500);
  return (data ?? []).map((p) => ({ id: p.id, name: p.name }));
}

/**
 * PM-01 요약 '이번 주 일정' — 내가 편집할 수 있는 프로젝트의 이번 주(일~토, 한국 날짜 · 달력과 같은 주)
 * 일정 수. 보관 제외. 조회 실패면 null (화면은 '—')
 */
export async function countEventsThisWeek(
  ctx: AccessContext,
  companyId: string,
  today: string = todayKst(),
): Promise<number | null> {
  try {
    const projects = await listEditableProjects(ctx, companyId);
    const week = weekDays(today);
    const events = await listEventsInRange(
      projects.map((p) => p.id),
      week[0]!,
      week[6]!,
      { archived: false, publicOnly: false },
    );
    return events.length;
  } catch {
    return null;
  }
}

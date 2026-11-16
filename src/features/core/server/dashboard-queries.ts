// src/features/core/server/dashboard-queries.ts (A · PM-00) — 업체 첫 화면(대시보드)의 조회
// 원본 단일(P-04): 모든 칸은 B·C 의 원본을 호출자 권한(RLS)으로 그때그때 조회한다. 복사·캐시 테이블 없음.
// 한 영역이 실패해도 나머지는 그린다 (overview-queries 의 safe 와 같은 방식).
import 'server-only';
import type { AccessContext, ProjectAccess, SummaryItem } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { logger } from '@/shared/lib/logger';
import { todayKst, weekdayOf } from '@/shared/lib/dates';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { summaryProvider as designsSummary } from '@/features/designs/server/summary';
import { summaryProvider as materialsSummary } from '@/features/materials/server/summary';
import {
  countUnansweredRequests,
  summaryProvider as requestsSummary,
} from '@/features/requests/server/summary';
import { summaryProvider as photosSummary } from '@/features/photos/server/summary';
import { nextScheduleProvider } from '@/features/schedule/server/summary';
import { listEditableProjects, listEventsInRange } from '@/features/schedule/server/queries';
import type { ProjectListItem } from '../types';
import { listProjects, projectStatusCounts } from './project-queries';

export const DASHBOARD_TABS = [
  'all',
  'projects',
  'requests',
  'schedule',
  'documents',
  'photos',
] as const;
export type DashboardTab = (typeof DASHBOARD_TABS)[number];

export const parseDashboardTab = (raw: string | undefined): DashboardTab =>
  (DASHBOARD_TABS as readonly string[]).includes(raw ?? '') ? (raw as DashboardTab) : 'all';

/** 진행 중 프로젝트 중 요약을 불러올 최대 개수 (프로젝트마다 요약 조회가 몇 번씩 일어난다) */
const MAX_PROJECTS = 8;

export interface DashProject extends ProjectListItem {
  coverFileId: string | null;
  /** 공사 기간 중 지난 비율 0~100 (시작·끝 날짜가 모두 있을 때만) */
  periodPct: number | null;
  next: SummaryItem | null;
}

export interface DashItem extends SummaryItem {
  projectId: string;
  projectName: string;
}

export interface WeekEvent {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  progress: string;
  href: string;
}

export interface DashboardData {
  today: string;
  /** 이번 주 (일~토, 전체 캘린더와 같은 주) */
  week: string[];
  counts: { active: number; planned: number } | null;
  unanswered: number | null;
  projects: DashProject[];
  openRequests: DashItem[];
  pendingDesigns: DashItem[];
  recentDocuments: DashItem[];
  photos: DashItem[];
  weekEvents: WeekEvent[];
  /** 어느 한 영역이라도 불러오지 못했으면 true (화면 위에 짧게 알린다) */
  failed: boolean;
}

/** 'YYYY-MM-DD' 에 n 일 더하기 (달력 값 — 시간대 변환 없음) */
export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! + n));
  return t.toISOString().slice(0, 10);
}

export function weekOf(today: string): string[] {
  const start = addDays(today, -weekdayOf(today));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** 공사 기간 중 지난 비율 (오늘 포함). 기간이 없거나 거꾸로면 null */
export function periodPercent(
  start: string | null,
  end: string | null,
  today: string,
): number | null {
  if (!start || !end || end < start) return null;
  const day = (s: string) => Date.parse(`${s}T00:00:00Z`) / 86_400_000;
  const total = day(end) - day(start) + 1;
  const done = day(today) - day(start) + 1;
  return Math.round(Math.min(1, Math.max(0, done / total)) * 100);
}

async function safe<T>(label: string, fallback: T, fn: () => Promise<T>): Promise<[T, boolean]> {
  try {
    return [await fn(), false];
  } catch (e) {
    logger.warn('dashboard.block.failed', {
      action: label,
      code: e instanceof Error ? e.name : 'unknown',
    });
    return [fallback, true];
  }
}

const byAtDesc = (a: SummaryItem, b: SummaryItem) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);

/** 고객에게 공개했지만 아직 확정되지 않은 도안 (confirm_state: none · needs_reconfirm) */
async function listPendingDesigns(projectIds: string[]) {
  if (projectIds.length === 0) return [];
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('designs')
    .select('id, project_id, title, updated_at')
    .in('project_id', projectIds)
    .eq('is_public', true)
    .neq('confirm_state', 'confirmed')
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(`dashboard.pendingDesigns:${error.code ?? 'unknown'}`);
  return data ?? [];
}

export async function loadDashboard(
  ctx: AccessContext,
  staff: { companyId: string; slug: string },
  opts: { photoLimit?: number } = {},
): Promise<DashboardData> {
  const today = todayKst();
  const week = weekOf(today);
  const { companyId, slug } = staff;

  const [[counts, f1], [active, f2], [unanswered], [editable, f3]] = await Promise.all([
    safe('counts', null, () => projectStatusCounts(companyId)),
    safe('active', [] as ProjectListItem[], async () => {
      const r = await listProjects(companyId, { status: 'active' });
      if (r.error) throw new Error('dashboard.active');
      return r.items;
    }),
    safe('unanswered', null, () => countUnansweredRequests(companyId)),
    safe('editable', [] as { id: string; name: string }[], () =>
      listEditableProjects(ctx, companyId),
    ),
  ]);

  const shown = active.slice(0, MAX_PROJECTS);
  const nameOf = new Map(editable.map((p) => [p.id, p.name]));
  for (const p of active) nameOf.set(p.id, p.name);
  const viewer = (projectId: string): ProjectAccess => ({
    projectId,
    companyId,
    companySlug: slug,
    as: 'editor',
    canConfirm: false,
  });
  const tag = (projectId: string) => (it: SummaryItem) => ({
    ...it,
    projectId,
    projectName: nameOf.get(projectId) ?? '',
  });

  const perProject = await Promise.all(
    shown.map(async (p) => {
      const v = viewer(p.id);
      const [[requests, a], [photos, b], [next, c], [designs, d], [materials, e]] =
        await Promise.all([
          safe('requests', [] as SummaryItem[], () => requestsSummary.recent(p.id, v, 20)),
          safe('photos', [] as SummaryItem[], () =>
            photosSummary.recent(p.id, v, opts.photoLimit ?? 6),
          ),
          safe('next', [] as SummaryItem[], () => nextScheduleProvider.next(p.id, v, 1)),
          safe('designs', [] as SummaryItem[], () => designsSummary.recent(p.id, v, 5)),
          safe('materials', [] as SummaryItem[], () => materialsSummary.recent(p.id, v, 5)),
        ]);
      return {
        project: p,
        requests: requests.map(tag(p.id)),
        photos: photos.map(tag(p.id)),
        next: next[0] ?? null,
        documents: [...designs, ...materials].map(tag(p.id)),
        failed: a || b || c || d || e,
      };
    }),
  );

  const editableIds = editable.map((p) => p.id);
  const [[events, f4], [pending, f5]] = await Promise.all([
    safe('week', [] as Awaited<ReturnType<typeof listEventsInRange>>, () =>
      listEventsInRange(editableIds, week[0]!, week[6]!, { archived: false, publicOnly: false }),
    ),
    safe('pendingDesigns', [] as Awaited<ReturnType<typeof listPendingDesigns>>, () =>
      listPendingDesigns(editableIds),
    ),
  ]);

  const openRequests = perProject
    .flatMap((x) => x.requests)
    .filter((r) => r.subtitleValues?.status !== 'resolved')
    .sort(byAtDesc);

  return {
    today,
    week,
    counts: counts ? { active: counts.active, planned: counts.planned } : null,
    unanswered,
    projects: perProject.map((x) => ({
      ...x.project,
      coverFileId: x.photos[0]?.thumbnailFileId ?? null,
      periodPct: periodPercent(x.project.startDate, x.project.endDate, today),
      next: x.next,
    })),
    openRequests,
    pendingDesigns: pending.map((d) => ({
      kind: 'designs',
      id: d.id,
      title: d.title,
      at: d.updated_at,
      screenId: 'PM-14',
      href: routes.app.design(slug, d.project_id, d.id),
      projectId: d.project_id,
      projectName: nameOf.get(d.project_id) ?? '',
    })),
    recentDocuments: perProject
      .flatMap((x) => x.documents)
      .sort(byAtDesc)
      .slice(0, 12),
    photos: perProject
      .flatMap((x) => x.photos)
      .sort(byAtDesc)
      .slice(0, opts.photoLimit ?? 6),
    weekEvents: events.map((e) => ({
      id: e.id,
      projectId: e.projectId,
      projectName: nameOf.get(e.projectId) ?? '',
      title: e.title,
      startDate: e.startDate,
      endDate: e.endDate,
      startTime: e.startTime,
      progress: e.progress,
      href: routes.app.scheduleEvent(slug, e.projectId, e.id),
    })),
    failed: f1 || f2 || f3 || f4 || f5 || perProject.some((x) => x.failed),
  };
}

/** 그날 걸친 일정인지 (종료일 포함) */
export const isOnDay = (e: { startDate: string; endDate: string | null }, ymd: string) =>
  e.startDate <= ymd && (e.endDate ?? e.startDate) >= ymd;

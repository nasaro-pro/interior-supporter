// src/features/core/server/notification-queries.ts (A · TASK-010) — 알림 목록 PM-50/CL-50/FW-50 (REQ-040)
import 'server-only';
import { cache } from 'react';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { PAGE_SIZE } from '@/shared/contracts/domain';
import { logger } from '@/shared/lib/logger';
import { resolverFor } from '../notifications/targets';
import { decodeCursor, encodeCursor } from './list-utils';
import { loadAccessContext } from './access';
import type { NotificationItem } from '../types';

export type Area = 'app' | 'portal' | 'field';

/** 알림이 속한 영역 — 수신 역할이 아니라 알림 종류·대상으로 판단 (03 문서 6.2 링크 열) */
const PM_TYPES = new Set([
  'item_confirmed',
  'request_created',
  'request_corrected',
  'photo_uploaded',
]);
const CUSTOMER_TYPES = new Set([
  'item_published',
  'reconfirm_requested',
  'request_replied',
  'request_status_changed',
  'photo_published',
  'schedule_changed',
]);

export function areaOfNotification(type: string, fallback: Area): Area {
  // CR-11(F11): 시공팀 영역에서 연 알림은 시공팀 링크로 (일정 변경도 시공팀 탭으로 간다)
  if (fallback === 'field') return 'field';
  if (PM_TYPES.has(type)) return 'app';
  if (CUSTOMER_TYPES.has(type)) return 'portal';
  return fallback; // assignment_changed: 열람 영역 기준
}

/**
 * A-07: 영역별로 보여 줄 알림 종류. 시공팀이 받는 알림은 배정 변경과, 일정 탭이 켜진 현장의 일정 변경(CR-11, F11)이다.
 * assignment_changed 는 역할 영역을 행만으로 알 수 없어 모든 영역에 보이고, 해석기가 영역에 맞는 링크를 만든다.
 */
const AREA_TYPES: Record<Area, readonly string[]> = {
  app: [...PM_TYPES, 'assignment_changed'],
  portal: [...CUSTOMER_TYPES, 'assignment_changed'],
  field: ['assignment_changed', 'schedule_changed'],
};

export function typesForArea(area: Area): string[] {
  return [...AREA_TYPES[area]];
}

export function isTypeInArea(type: string, area: Area): boolean {
  // area 는 Server Action 인자로도 들어온다 — 모르는 값이면 false
  return Object.hasOwn(AREA_TYPES, area) && AREA_TYPES[area].includes(type);
}

/** PM 영역은 그 업체 알림만 (slug → companyId). 구성원이 아니면 null(빈 결과) */
function companyFilter(
  ctx: { memberships: { slug: string; companyId: string }[] },
  area: Area,
  slug: string | undefined,
): { companyId?: string } | null {
  if (area !== 'app' || !slug) return {};
  const s = decodeURIComponent(slug).toLowerCase();
  const m = ctx.memberships.find((x) => x.slug.toLowerCase() === s);
  return m ? { companyId: m.companyId } : null;
}

/** 안 읽은 수 (헤더 배지) — A-07: 영역(+PM 은 업체)별, 내 알림만 */
export const unreadCount = cache(async (area: Area, companyId?: string): Promise<number> => {
  const ctx = await loadAccessContext();
  if (!ctx) return 0;
  const supabase = await createServerSupabase();
  let q = supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', ctx.userId)
    .in('type', typesForArea(area))
    .is('read_at', null);
  if (area === 'app' && companyId) q = q.eq('company_id', companyId);
  const { count, error } = await q;
  if (error) logger.warn('notifications.unread.failed', { userId: ctx.userId, dbCode: error.code });
  return count ?? 0;
});

/** 작은 동시 실행 제한 (해석기가 각자 쿼리를 하므로 한꺼번에 20개를 쏘지 않는다) */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export const RESOLVE_CONCURRENCY = 4;

/** A-14: 프로젝트 이름 한 번에 — 시공팀은 projects 를 못 읽으므로 field_projects() (DB-05) */
async function projectNames(area: Area, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const supabase = await createServerSupabase();
  if (area === 'field') {
    const { data, error } = await supabase.rpc('field_projects');
    if (error) logger.warn('notifications.project_names.failed', { dbCode: error.code });
    const wanted = new Set(unique);
    return new Map((data ?? []).filter((p) => wanted.has(p.id)).map((p) => [p.id, p.name]));
  }
  const { data, error } = await supabase.from('projects').select('id, name').in('id', unique);
  if (error) logger.warn('notifications.project_names.failed', { dbCode: error.code });
  return new Map((data ?? []).map((p) => [p.id, p.name]));
}

export async function listNotifications(
  area: Area,
  cursor?: string,
  slug?: string,
): Promise<{ items: NotificationItem[]; nextCursor: string | null; error: boolean }> {
  const ctx = await loadAccessContext();
  if (!ctx) return { items: [], nextCursor: null, error: true };
  const scope = companyFilter(ctx, area, slug);
  if (!scope) return { items: [], nextCursor: null, error: false };
  const supabase = await createServerSupabase();
  let q = supabase
    .from('notifications')
    .select('id, type, object_type, object_id, project_id, company_id, created_at, read_at')
    .eq('recipient_id', ctx.userId) // 심층 방어 (RLS 도 recipient_id = auth.uid())
    .in('type', typesForArea(area));
  if (scope.companyId) q = q.eq('company_id', scope.companyId);
  const cur = decodeCursor(cursor);
  if (cur) q = q.or(`created_at.lt.${cur.at},and(created_at.eq.${cur.at},id.lt.${cur.id})`);
  const { data, error } = await q
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (error) {
    logger.warn('notifications.list.failed', { userId: ctx.userId, dbCode: error.code });
    return { items: [], nextCursor: null, error: true };
  }
  const page = data.slice(0, PAGE_SIZE);
  const names = await projectNames(
    area,
    page.flatMap((n) => (n.project_id ? [n.project_id] : [])),
  );

  // 제목은 현재 권한으로 다시 조회 (POL-027). 못 보면 null → "더 이상 볼 수 없는 항목"
  const items = await mapLimit(page, RESOLVE_CONCURRENCY, async (n): Promise<NotificationItem> => {
    const slugOf = ctx.memberships.find((m) => m.companyId === n.company_id)?.slug ?? '';
    const resolver = resolverFor(n.object_type);
    let targetTitle: string | null = null;
    if (resolver && n.project_id) {
      try {
        const target = await resolver(
          n.object_id,
          n.project_id,
          areaOfNotification(n.type, area),
          slugOf,
        );
        targetTitle = target?.title ?? null;
      } catch (e) {
        logger.warn('notifications.resolve.failed', {
          objectId: n.object_id,
          code: e instanceof Error ? e.name : 'unknown',
        });
      }
    }
    return {
      id: n.id,
      type: n.type,
      objectType: n.object_type,
      createdAt: n.created_at,
      readAt: n.read_at,
      // 대상을 더 볼 수 없으면 프로젝트 이름도 숨긴다 (POL-027)
      projectName: targetTitle !== null && n.project_id ? (names.get(n.project_id) ?? null) : null,
      targetTitle,
    };
  });
  const last = page.at(-1);
  return {
    items,
    nextCursor: data.length > PAGE_SIZE && last ? encodeCursor(last.created_at, last.id) : null,
    error: false,
  };
}

// src/features/core/server/history-queries.ts (A · TASK-014) — 변경이력 PM-40/41 (POL-028: 트리거 기록, 스태프만, 권한 범위만)
import 'server-only';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { PAGE_SIZE } from '@/shared/contracts/domain';
import type { Json } from '@/shared/contracts/database.types';
import { kstDayEnd, kstDayStart } from './list-utils';
import { displayNames } from './participant-queries';
import type { AuditItem } from '../types';

export interface HistoryFilter {
  projectId?: string;
  objectType?: string;
  from?: string; // YYYY-MM-DD (KST)
  to?: string;
  cursor?: string; // 마지막 id (bigint identity — 시간순과 같은 방향)
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

async function projectNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('projects').select('id, name').in('id', unique);
  return new Map((data ?? []).map((p) => [p.id, p.name]));
}

export async function listAuditEvents(
  companyId: string,
  f: HistoryFilter,
): Promise<{ items: AuditItem[]; nextCursor: string | null; error: boolean }> {
  const supabase = await createServerSupabase();
  let q = supabase
    .from('audit_events')
    .select('id, occurred_at, event_type, object_type, object_id, project_id, actor_id')
    .eq('company_id', companyId);
  if (f.projectId) q = q.eq('project_id', f.projectId);
  if (f.objectType) q = q.eq('object_type', f.objectType);
  if (f.from && YMD.test(f.from)) q = q.gte('occurred_at', kstDayStart(f.from));
  if (f.to && YMD.test(f.to)) q = q.lte('occurred_at', kstDayEnd(f.to));
  const cursor = f.cursor && /^\d+$/.test(f.cursor) ? Number(f.cursor) : null;
  if (cursor) q = q.lt('id', cursor);
  const { data, error } = await q.order('id', { ascending: false }).limit(PAGE_SIZE + 1);
  if (error) return { items: [], nextCursor: null, error: true };
  const page = data.slice(0, PAGE_SIZE);
  const [names, projects] = await Promise.all([
    displayNames(page.flatMap((r) => (r.actor_id ? [r.actor_id] : []))),
    projectNames(page.flatMap((r) => (r.project_id ? [r.project_id] : []))),
  ]);
  const last = page.at(-1);
  return {
    items: page.map((r) => ({
      id: r.id,
      occurredAt: r.occurred_at,
      eventType: r.event_type,
      objectType: r.object_type,
      objectId: r.object_id,
      projectId: r.project_id,
      projectName: r.project_id ? (projects.get(r.project_id) ?? null) : null,
      actorName: r.actor_id ? (names.get(r.actor_id) ?? null) : null,
    })),
    nextCursor: data.length > PAGE_SIZE && last ? String(last.id) : null,
    error: false,
  };
}

export async function getAuditEvent(
  companyId: string,
  eventId: string,
): Promise<(AuditItem & { before: Record<string, Json>; after: Record<string, Json> }) | null> {
  if (!/^\d+$/.test(eventId)) return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('audit_events')
    .select(
      'id, occurred_at, event_type, object_type, object_id, project_id, actor_id, before, after',
    )
    .eq('company_id', companyId)
    .eq('id', Number(eventId))
    .maybeSingle();
  if (!data) return null;
  const [names, projects] = await Promise.all([
    displayNames(data.actor_id ? [data.actor_id] : []),
    projectNames(data.project_id ? [data.project_id] : []),
  ]);
  const asObj = (v: Json | null): Record<string, Json> =>
    v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, Json>) : {};
  return {
    id: data.id,
    occurredAt: data.occurred_at,
    eventType: data.event_type,
    objectType: data.object_type,
    objectId: data.object_id,
    projectId: data.project_id,
    projectName: data.project_id ? (projects.get(data.project_id) ?? null) : null,
    actorName: data.actor_id ? (names.get(data.actor_id) ?? null) : null,
    before: asObj(data.before),
    after: asObj(data.after),
  };
}

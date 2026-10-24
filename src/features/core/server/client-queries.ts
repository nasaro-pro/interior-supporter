// src/features/core/server/client-queries.ts (A · TASK-013) — 고객 카드 PM-20/21 (POL-032: 카드 1 : 프로젝트 N)
import 'server-only';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { PAGE_SIZE } from '@/shared/contracts/domain';
import { decodeCursor, encodeCursor, sanitizeSearch } from './list-utils';
import { editableProjectIds, editableScope } from './project-queries';
import type { ClientItem, ProjectListItem } from '../types';

type ClientRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  memo: string;
  archived_at: string | null;
  updated_at: string;
  created_at: string;
  version: number;
};

const toItem = (r: ClientRow): ClientItem => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  email: r.email,
  memo: r.memo,
  archivedAt: r.archived_at,
  updatedAt: r.updated_at,
  version: r.version,
});

export async function listClients(
  companyId: string,
  filter: { q?: string; archived?: boolean; cursor?: string },
): Promise<{ items: ClientItem[]; nextCursor: string | null; error: boolean }> {
  const supabase = await createServerSupabase();
  let query = supabase
    .from('clients')
    .select('id, name, phone, email, memo, archived_at, updated_at, created_at, version')
    .eq('company_id', companyId);
  query = filter.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
  const q = sanitizeSearch(filter.q);
  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  const cur = decodeCursor(filter.cursor);
  if (cur) query = query.or(`created_at.lt.${cur.at},and(created_at.eq.${cur.at},id.lt.${cur.id})`);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (error) return { items: [], nextCursor: null, error: true };
  const page = data.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  return {
    items: page.map(toItem),
    nextCursor: data.length > PAGE_SIZE && last ? encodeCursor(last.created_at, last.id) : null,
    error: false,
  };
}

/** A-11: 경로의 업체 카드만 (여러 업체 구성원이 A 업체 경로로 B 업체 카드를 열지 못하게) */
export async function getClient(clientId: string, companyId: string): Promise<ClientItem | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('clients')
    .select('id, name, phone, email, memo, archived_at, updated_at, created_at, version')
    .eq('id', clientId)
    .eq('company_id', companyId)
    .maybeSingle();
  return data ? toItem(data) : null;
}

/**
 * 고객 카드에 연결된 프로젝트 — 유효 연결(archived_at is null)·편집 가능한 것만
 * (A-11: 링크 대상도 현재 편집 권한 범위, TR-06. RLS 는 고객 열람분도 합쳐 보여 준다)
 */
export async function listClientProjects(
  clientId: string,
  companyId: string,
): Promise<ProjectListItem[]> {
  const scope = await editableScope(companyId);
  if (scope.kind === 'none') return [];
  const supabase = await createServerSupabase();
  const { data: links } = await supabase
    .from('client_projects')
    .select('project_id')
    .eq('client_id', clientId)
    .eq('company_id', companyId)
    .is('archived_at', null);
  let ids = (links ?? []).map((l) => l.project_id);
  if (scope.kind === 'ids') {
    const allowed = new Set(scope.ids);
    ids = ids.filter((id) => allowed.has(id));
  }
  if (!ids.length) return [];
  const { data } = await supabase
    .from('projects')
    .select(
      'id, name, site_address, start_date, end_date, status, current_phase, is_public, archived_at',
    )
    .eq('company_id', companyId)
    .in('id', ids)
    .order('created_at', { ascending: false });
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    siteAddress: p.site_address,
    startDate: p.start_date,
    endDate: p.end_date,
    status: p.status,
    currentPhase: p.current_phase,
    isPublic: p.is_public,
    archivedAt: p.archived_at,
  }));
}

/** 연결 가능한 프로젝트 = 편집 가능 + 아직 어떤 카드에도 연결되지 않음 (D03) */
export async function listLinkableProjects(
  companyId: string,
): Promise<{ id: string; name: string }[]> {
  const supabase = await createServerSupabase();
  const [{ data: projects }, { data: links }, editable] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name')
      .eq('company_id', companyId)
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('client_projects')
      .select('project_id')
      .eq('company_id', companyId)
      .is('archived_at', null), // DB-08: 해제된 연결은 다시 연결할 수 있다
    editableProjectIds(companyId),
  ]);
  const linked = new Set((links ?? []).map((l) => l.project_id));
  return (projects ?? []).filter((p) => editable.has(p.id) && !linked.has(p.id));
}

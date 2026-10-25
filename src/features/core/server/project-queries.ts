// src/features/core/server/project-queries.ts (A · TASK-005·006·009) — 조회 (Server Component 에서 호출). snake→camel 변환은 여기서만
import 'server-only';
import { cache } from 'react';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { PAGE_SIZE, type ProjectStatus } from '@/shared/contracts/domain';
import type { ProjectHeaderData } from '@/shared/contracts/integration';
import { logger } from '@/shared/lib/logger';
import { isWithin, todayKst } from '@/shared/lib/dates';
import { normalizeHomeSections } from '../home-sections';
import { normalizeHomeTheme } from '../home-theme';
import { normalizePageImages, normalizePageTone } from '../page-theme';
import { decodeCursor, encodeCursor, sanitizeSearch } from './list-utils';
import type { ProjectDetail, ProjectListItem } from '../types';

const PROJECT_COLUMNS =
  'id, company_id, name, site_address, start_date, end_date, status, current_phase, is_public, home_message, home_sections, home_theme, page_images, page_tone, created_at, updated_at, archived_at, version';

type ProjectRow = {
  id: string;
  company_id: string;
  name: string;
  site_address: string;
  start_date: string | null;
  end_date: string | null;
  status: ProjectStatus;
  current_phase: string;
  is_public: boolean;
  home_message: string;
  home_sections: unknown;
  home_theme: string;
  page_images: unknown;
  page_tone: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  version: number;
};

const toDetail = (r: ProjectRow): ProjectDetail => ({
  id: r.id,
  companyId: r.company_id,
  name: r.name,
  siteAddress: r.site_address,
  startDate: r.start_date,
  endDate: r.end_date,
  status: r.status,
  currentPhase: r.current_phase,
  isPublic: r.is_public,
  homeMessage: r.home_message,
  homeSections: normalizeHomeSections(r.home_sections),
  homeTheme: normalizeHomeTheme(r.home_theme),
  pageImages: normalizePageImages(r.page_images),
  pageTone: normalizePageTone(r.page_tone),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  archivedAt: r.archived_at,
  version: r.version,
});

export interface ProjectListFilter {
  q?: string;
  status?: ProjectStatus;
  archived?: boolean;
  cursor?: string;
}

/** PM-01: 편집 가능한 프로젝트만 (RLS can_edit_project) — REQ-010 */
export async function listProjects(
  companyId: string,
  filter: ProjectListFilter,
): Promise<{ items: ProjectListItem[]; nextCursor: string | null; error: boolean }> {
  // A-05: 편집 범위를 쿼리에 넣는다 (limit 뒤에 거르면 pm 의 페이지가 짧거나 비고 커서가 끊긴다)
  // RLS 는 편집·고객 열람을 합쳐 보여 주므로 pm 은 유효 배정 id 로 좁힌다. owner/manager 는 업체 전체.
  const scope = await editableScope(companyId);
  if (scope.kind === 'none') return { items: [], nextCursor: null, error: false };
  const supabase = await createServerSupabase();
  let query = supabase
    .from('projects')
    .select(
      'id, name, site_address, start_date, end_date, status, current_phase, is_public, archived_at, created_at',
    )
    .eq('company_id', companyId);
  if (scope.kind === 'ids') query = query.in('id', scope.ids);
  query = filter.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
  if (filter.status) query = query.eq('status', filter.status);
  const q = sanitizeSearch(filter.q);
  if (q) query = query.or(`name.ilike.%${q}%,site_address.ilike.%${q}%`);
  const cur = decodeCursor(filter.cursor);
  if (cur) query = query.or(`created_at.lt.${cur.at},and(created_at.eq.${cur.at},id.lt.${cur.id})`);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (error) {
    logger.warn('projects.list.failed', { companyId, dbCode: error.code });
    return { items: [], nextCursor: null, error: true };
  }
  const page = data.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  return {
    items: page.map((r) => ({
      id: r.id,
      name: r.name,
      siteAddress: r.site_address,
      startDate: r.start_date,
      endDate: r.end_date,
      status: r.status,
      currentPhase: r.current_phase,
      isPublic: r.is_public,
      archivedAt: r.archived_at,
    })),
    nextCursor: data.length > PAGE_SIZE && last ? encodeCursor(last.created_at, last.id) : null,
    error: false,
  };
}

export type EditableScope =
  | { kind: 'all' } // owner/manager — 업체 전체
  | { kind: 'ids'; ids: string[] } // pm — 유효 배정분 (1개 이상)
  | { kind: 'none' }; // 구성원 아님 또는 배정 없음

/** 내 편집 범위 (업체 owner/manager = 전체, pm = 유효 배정분). 쿼리 조건으로 쓴다 */
export const editableScope = cache(async (companyId: string): Promise<EditableScope> => {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return { kind: 'none' };
  const { data: member } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', uid)
    .is('removed_at', null)
    .maybeSingle();
  if (!member) return { kind: 'none' };
  if (member.role === 'owner' || member.role === 'manager') return { kind: 'all' };
  const { data: parts } = await supabase
    .from('project_participants')
    .select('project_id, valid_from, valid_until')
    .eq('user_id', uid)
    .eq('role', 'pm')
    .eq('company_id', companyId)
    .is('revoked_at', null);
  const today = todayKst();
  const ids = [
    ...new Set(
      (parts ?? [])
        .filter((p) => isWithin(today, p.valid_from, p.valid_until))
        .map((p) => p.project_id),
    ),
  ];
  return ids.length ? { kind: 'ids', ids } : { kind: 'none' };
});

/** 내가 편집할 수 있는 프로젝트 id (업체 owner/manager = 전체, pm = 유효 배정분) */
export const editableProjectIds = cache(async (companyId: string): Promise<Set<string>> => {
  const scope = await editableScope(companyId);
  if (scope.kind === 'none') return new Set();
  if (scope.kind === 'ids') return new Set(scope.ids);
  const supabase = await createServerSupabase();
  const { data: all } = await supabase.from('projects').select('id').eq('company_id', companyId);
  return new Set((all ?? []).map((p) => p.id));
});

/** PM-01 요약 수치 — 목록과 같은 권한 범위 (REQ-010) */
export async function projectStatusCounts(
  companyId: string,
): Promise<Record<ProjectStatus, number> | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('projects')
    .select('id, status')
    .eq('company_id', companyId)
    .is('archived_at', null);
  if (error) return null;
  const editable = await editableProjectIds(companyId);
  const counts: Record<ProjectStatus, number> = { planned: 0, active: 0, on_hold: 0, completed: 0 };
  for (const r of data) if (editable.has(r.id)) counts[r.status] += 1;
  return counts;
}

/** 프로젝트 하나 (RLS 가 볼 수 있을 때만) */
export const getProject = cache(async (projectId: string): Promise<ProjectDetail | null> => {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
    .eq('id', projectId)
    .maybeSingle();
  return data ? toDetail(data as ProjectRow) : null;
});

/** CT: ProjectHeaderData (integration.ts 2장) */
export async function getProjectHeader(projectId: string): Promise<ProjectHeaderData | null> {
  const p = await getProject(projectId);
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    siteAddress: p.siteAddress,
    startDate: p.startDate,
    endDate: p.endDate,
    status: p.status,
    currentPhase: p.currentPhase,
  };
}

/** 헤더 프로젝트 전환 목록 (보관 제외, 최근 50개) — A-05: 편집 범위를 쿼리에 넣는다 */
export async function listSwitcherProjects(
  companyId: string,
): Promise<{ id: string; name: string }[]> {
  const scope = await editableScope(companyId);
  if (scope.kind === 'none') return [];
  const supabase = await createServerSupabase();
  let query = supabase
    .from('projects')
    .select('id, name')
    .eq('company_id', companyId)
    .is('archived_at', null);
  if (scope.kind === 'ids') query = query.in('id', scope.ids);
  const { data } = await query.order('updated_at', { ascending: false }).limit(50);
  return (data ?? []).map((p) => ({ id: p.id, name: p.name }));
}

/** CL-01: 초대된 공개 프로젝트만, 업체명으로 묶음 (REQ-015, POL-004) */
export async function listPortalProjects(
  projectIds: string[],
): Promise<{ companyId: string; companyName: string; projects: ProjectListItem[] }[] | null> {
  if (projectIds.length === 0) return [];
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('projects')
    .select(
      'id, company_id, name, site_address, start_date, end_date, status, current_phase, is_public, archived_at',
    )
    .in('id', projectIds)
    .eq('is_public', true)
    .is('archived_at', null)
    .order('updated_at', { ascending: false });
  if (error) return null;
  const companyIds = [...new Set(data.map((p) => p.company_id))];
  const { data: companies } = companyIds.length
    ? await supabase.from('companies').select('id, name').in('id', companyIds)
    : { data: [] as { id: string; name: string }[] };
  const nameOf = new Map((companies ?? []).map((c) => [c.id, c.name]));
  const groups = new Map<string, ProjectListItem[]>();
  for (const p of data) {
    const list = groups.get(p.company_id) ?? [];
    list.push({
      id: p.id,
      name: p.name,
      siteAddress: p.site_address,
      startDate: p.start_date,
      endDate: p.end_date,
      status: p.status,
      currentPhase: p.current_phase,
      isPublic: p.is_public,
      archivedAt: p.archived_at,
    });
    groups.set(p.company_id, list);
  }
  return [...groups.entries()].map(([companyId, projects]) => ({
    companyId,
    companyName: nameOf.get(companyId) ?? '',
    projects,
  }));
}

/** 업체 기본 정보 (헤더 표시용) */
export const getCompanyBasics = cache(async (companyId: string) => {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('companies')
    .select('id, slug, name, logo_file_id, version')
    .eq('id', companyId)
    .maybeSingle();
  return data
    ? {
        id: data.id,
        slug: data.slug,
        name: data.name,
        logoFileId: data.logo_file_id,
        version: data.version,
      }
    : null;
});

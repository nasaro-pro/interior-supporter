// 일정 관련 항목 (REQ-231·REQ-232) — B 코드를 import 하지 않고 사용자 권한으로 원본 테이블만 조회, 링크는 routes 로만.
// 다른 프로젝트 항목도 연결할 수 있다 (C 결정 2026-10-07): 같은 업체 안, 내가 편집할 수 있는 프로젝트의 항목만 선택지에 둔다.
// 표시할 때는 현재 사용자 권한(RLS)으로 다시 조회해 볼 수 없으면 링크하지 않는다 → "연결된 항목을 볼 수 없습니다".
import 'server-only';
import { getAccessContext } from '@/features/core';
import { routes } from '@/shared/contracts/routes';
import { photoLabel } from '@/features/photos/lib/label';
import { logger } from '@/shared/lib/logger';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import type { RelatedType } from '../schema';
import type { ScheduleEvent } from '../types';
import { listEditableProjects } from './queries';

export interface RelatedOption {
  type: RelatedType;
  id: string;
  projectId: string;
  /** 사용자 입력 원문 (번역하지 않음). 사진은 설명 또는 촬영일 */
  label: string;
}

const LIMIT = 200;

/** 편집 가능한 프로젝트들의 항목 (종류별 최근 200개, 보관 제외) — 폼에서 프로젝트별로 묶어 보여 준다 */
export async function listRelatedOptions(projectIds: string[]): Promise<RelatedOption[]> {
  if (projectIds.length === 0) return [];
  const supabase = await createServerSupabase();
  const [designs, materials, versions, requests, photos] = await Promise.all([
    supabase
      .from('designs')
      .select('id, project_id, title')
      .in('project_id', projectIds)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(LIMIT),
    supabase
      .from('materials')
      .select('id, project_id, name')
      .in('project_id', projectIds)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(LIMIT),
    supabase
      .from('estimate_versions')
      .select('id, project_id, version_label, version_no')
      .in('project_id', projectIds)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(LIMIT),
    supabase
      .from('requests')
      .select('id, project_id, title')
      .in('project_id', projectIds)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(LIMIT),
    supabase
      .from('photos')
      .select('id, project_id, description, captured_on, created_at')
      .in('project_id', projectIds)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(LIMIT),
  ]);
  // 종류별 최근 LIMIT 개만 — 잘렸으면 경고 로그 (선택지가 일부일 수 있음, C-08)
  const truncated = [designs, materials, versions, requests, photos].some(
    (r) => (r.data?.length ?? 0) >= LIMIT,
  );
  if (truncated) logger.warn('schedule.related_options.truncated', { code: String(LIMIT) });
  return [
    ...(designs.data ?? []).map((d) => ({
      type: 'designs' as const,
      id: d.id,
      projectId: d.project_id,
      label: d.title,
    })),
    ...(materials.data ?? []).map((m) => ({
      type: 'materials' as const,
      id: m.id,
      projectId: m.project_id,
      label: m.name,
    })),
    ...(versions.data ?? []).map((v) => ({
      type: 'estimate_versions' as const,
      id: v.id,
      projectId: v.project_id,
      label: `${v.version_label} (v${v.version_no})`,
    })),
    ...(requests.data ?? []).map((r) => ({
      type: 'requests' as const,
      id: r.id,
      projectId: r.project_id,
      label: r.title,
    })),
    ...(photos.data ?? []).map((p) => ({
      type: 'photos' as const,
      id: p.id,
      projectId: p.project_id,
      label: photoLabel(p),
    })),
  ];
}

/** 폼이 닫혀 있을 때 쓰는 빈 선택지 (C-08 — 폼을 열 때만 조회) */
export const NO_RELATED_CHOICES: { options: RelatedOption[]; names: Record<string, string> } = {
  options: [],
  names: {},
};

/** 폼 선택지 — 같은 업체에서 편집 가능한 프로젝트 전체의 항목 + 프로젝트 이름 (PM-08 등록·PM-18 수정) */
export async function loadRelatedChoices(
  companyId: string,
): Promise<{ options: RelatedOption[]; names: Record<string, string> }> {
  const ctx = await getAccessContext();
  const projects = await listEditableProjects(ctx, companyId);
  const options = await listRelatedOptions(projects.map((p) => p.id));
  return { options, names: Object.fromEntries(projects.map((p) => [p.id, p.name])) };
}

export type RelatedCheck = 'ok' | 'not_found' | 'other_company' | 'archived' | 'not_editable';

/**
 * 저장 전 검사 (C-05) — 선택지(loadRelatedChoices)와 같은 범위만 허용한다:
 * 현재 사용자에게 보이고(RLS) · 같은 업체(P-01) · 보관되지 않았고 · 내가 편집할 수 있는 프로젝트의 항목.
 * 호출자는 'ok' 외에는 모두 같은 오류로 돌려 존재를 숨긴다.
 */
export async function checkRelatedTarget(
  type: RelatedType,
  id: string,
  companyId: string,
): Promise<RelatedCheck> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from(type)
    .select('id, company_id, project_id, archived_at')
    .eq('id', id)
    .maybeSingle();
  if (!data) return 'not_found';
  if (data.company_id !== companyId) return 'other_company';
  if (data.archived_at) return 'archived';
  const ctx = await getAccessContext();
  const editable = await listEditableProjects(ctx, companyId);
  return editable.some((p) => p.id === data.project_id) ? 'ok' : 'not_editable';
}

export interface RelatedLink {
  type: RelatedType;
  label: string;
  href: string;
  /** 일정과 다른 프로젝트의 항목이면 그 프로젝트 이름 (같으면 null) */
  projectName: string | null;
}

/** 상세 화면의 관련 항목 링크 — 현재 사용자 권한으로 볼 수 있을 때만, 항목이 속한 프로젝트의 정규 경로로 */
export async function resolveRelatedLink(
  event: ScheduleEvent,
  area: 'app' | 'portal',
  companySlug: string,
): Promise<RelatedLink | null> {
  if (!event.relatedType || !event.relatedId) return null;
  const supabase = await createServerSupabase();
  const id = event.relatedId;
  let found: { type: RelatedType; projectId: string; label: string; href: string } | null = null;

  switch (event.relatedType) {
    case 'designs': {
      const { data } = await supabase
        .from('designs')
        .select('id, project_id, title')
        .eq('id', id)
        .maybeSingle();
      if (data) {
        const p = data.project_id;
        found = {
          type: 'designs',
          projectId: p,
          label: data.title,
          href:
            area === 'app' ? routes.app.design(companySlug, p, id) : routes.portal.design(p, id),
        };
      }
      break;
    }
    case 'materials': {
      const { data } = await supabase
        .from('materials')
        .select('id, project_id, name')
        .eq('id', id)
        .maybeSingle();
      if (data) {
        const p = data.project_id;
        found = {
          type: 'materials',
          projectId: p,
          label: data.name,
          href:
            area === 'app'
              ? routes.app.material(companySlug, p, id)
              : routes.portal.material(p, id),
        };
      }
      break;
    }
    case 'estimate_versions': {
      const { data } = await supabase
        .from('estimate_versions')
        .select('id, project_id, estimate_id, version_no, version_label')
        .eq('id', id)
        .maybeSingle();
      if (data) {
        const p = data.project_id;
        found = {
          type: 'estimate_versions',
          projectId: p,
          label: data.version_label,
          href:
            area === 'app'
              ? routes.app.estimate(companySlug, p, data.estimate_id, data.version_no)
              : routes.portal.estimate(p, data.estimate_id, data.version_no),
        };
      }
      break;
    }
    case 'requests': {
      // 고객은 본인이 쓴 요청만 보인다 (POL-018) — RLS 가 판정
      const { data } = await supabase
        .from('requests')
        .select('id, project_id, title')
        .eq('id', id)
        .maybeSingle();
      if (data) {
        const p = data.project_id;
        found = {
          type: 'requests',
          projectId: p,
          label: data.title,
          href:
            area === 'app' ? routes.app.request(companySlug, p, id) : routes.portal.request(p, id),
        };
      }
      break;
    }
    case 'photos': {
      const { data } = await supabase
        .from('photos')
        .select('id, project_id, description, captured_on, created_at, is_public')
        .eq('id', id)
        .maybeSingle();
      if (data && (area === 'app' || data.is_public)) {
        const p = data.project_id;
        found = {
          type: 'photos',
          projectId: p,
          label: photoLabel(data),
          href: area === 'app' ? routes.app.photo(companySlug, p, id) : routes.portal.photo(p, id),
        };
      }
      break;
    }
  }
  if (!found) return null;
  let projectName: string | null = null;
  if (found.projectId !== event.projectId) {
    const { data } = await supabase
      .from('projects')
      .select('name')
      .eq('id', found.projectId)
      .maybeSingle();
    if (!data) return null; // 항목은 보여도 프로젝트를 볼 수 없으면 링크하지 않는다
    projectName = data.name;
  }
  return { type: found.type, label: found.label, href: found.href, projectName };
}

// src/features/core/server/access.ts (A · TASK-002) — CT01 AccessContext 구현 (integration.ts 1장)
// 화면·액션의 1차 검사(조기 차단·존재 숨김). 실제 데이터 보호는 RLS 가 한다 (P-02).
import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { routes } from '@/shared/contracts/routes';
import { isWithin, todayKst } from '@/shared/lib/dates';
import { logger } from '@/shared/lib/logger';
import type { AccessContext, ProjectAccess } from '@/shared/contracts/integration';
import type { MemberRole } from '@/shared/contracts/domain';
import { firstLoginState } from '../account-utils';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: string) => UUID.test(v);

/** 로그인 사용자 id (없으면 null). 화면 분기용 — 권한 판단에 쓰지 않는다 */
export const getSessionUserId = cache(async (): Promise<string | null> => {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
});

/** 로그인 사용자의 접근 문맥. 없으면 null (리다이렉트하지 않음) */
export const loadAccessContext = cache(async (): Promise<AccessContext | null> => {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const [profileRes, memberRes, partRes] = await Promise.all([
    supabase.from('profiles').select('display_name, locale').eq('id', user.id).maybeSingle(),
    supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .is('removed_at', null),
    supabase
      .from('project_participants')
      .select('project_id, company_id, role, can_confirm, valid_from, valid_until')
      .eq('user_id', user.id)
      .is('revoked_at', null),
  ]);

  const members = memberRes.data ?? [];
  const companyIds = [...new Set(members.map((m) => m.company_id))];
  const companiesRes = companyIds.length
    ? await supabase.from('companies').select('id, slug, name').in('id', companyIds)
    : { data: [] as { id: string; slug: string; name: string }[] };
  const companyById = new Map((companiesRes.data ?? []).map((c) => [c.id, c]));

  const memberships = members.flatMap((m) => {
    const c = companyById.get(m.company_id);
    return c ? [{ companyId: c.id, slug: c.slug, name: c.name, role: m.role as MemberRole }] : [];
  });

  // POL-006: 기간은 KST 날짜, 양 끝 포함. 매 요청 판정
  const today = todayKst();
  const participations = (partRes.data ?? [])
    .filter((p) => isWithin(today, p.valid_from, p.valid_until))
    .map((p) => ({
      projectId: p.project_id,
      companyId: p.company_id,
      role: p.role,
      canConfirm: p.can_confirm,
    }));

  const areas: AccessContext['areas'] = [];
  if (memberships.length) areas.push('app');
  if (participations.some((p) => p.role === 'customer')) areas.push('portal');
  if (participations.some((p) => p.role === 'field')) areas.push('field');

  return {
    userId: user.id,
    displayName: profileRes.data?.display_name ?? user.email ?? '',
    locale: profileRes.data?.locale === 'en' ? 'en' : 'ko',
    memberships,
    participations,
    areas,
  };
});

/** D-15: 첫 로그인 비밀번호 변경 상태 (본인 프로필만 읽는다) */
export const loadFirstLoginState = cache(
  async (userId: string): Promise<'ready' | 'must_change' | 'expired'> => {
    const supabase = await createServerSupabase();
    const { data } = await supabase
      .from('profiles')
      .select('must_change_password, temp_password_expires_at')
      .eq('id', userId)
      .maybeSingle();
    return firstLoginState(data ?? null);
  },
);

/** D-11: 내 업체 중 아직 쓸 수 없는 업체(승인 대기·정지) — 영역 선택 화면 안내용 */
export const loadInactiveCompanies = cache(
  async (): Promise<{ id: string; name: string; status: 'pending' | 'suspended' }[]> => {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc('my_inactive_companies');
    if (error) {
      logger.warn('access.inactive_companies.failed', { dbCode: error.code });
      return [];
    }
    return (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status === 'suspended' ? 'suspended' : 'pending',
    }));
  },
);

/**
 * 미로그인 → 로그인 화면(현재 경로를 next 로).
 * D-15: 임시 비밀번호 상태면 어떤 화면보다 먼저 비밀번호 변경(AUTH-06)으로 보낸다.
 */
export async function getAccessContext(): Promise<AccessContext> {
  const ctx = await loadAccessContext();
  if (ctx) {
    if ((await loadFirstLoginState(ctx.userId)) !== 'ready') redirect(routes.changePassword());
    return ctx;
  }
  const h = await headers();
  redirect(routes.login(h.get('x-pathname') ?? undefined));
}

type ProjectRow = {
  id: string;
  company_id: string;
  is_public: boolean;
  archived_at: string | null;
};

/** 접근 판정용 최소 정보 (project_brief RPC 행) */
export type ProjectBrief = ProjectRow & { name: string; site_address: string };

/**
 * 접근 판정용 프로젝트 최소 정보 — DB-05: 시공팀은 projects 를 직접 읽을 수 없으므로
 * SECURITY DEFINER RPC `project_brief` 로만 읽는다 (편집자·고객·시공팀이 볼 수 있을 때만 1행).
 */
export const loadProjectBrief = cache(async (projectId: string): Promise<ProjectBrief | null> => {
  if (!isUuid(projectId)) return null;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('project_brief', { p_project: projectId });
  if (error) {
    logger.warn('access.project_brief.failed', { projectId, dbCode: error.code });
    return null;
  }
  const row = (data ?? [])[0];
  if (!row) return null;
  return {
    id: row.id,
    company_id: row.company_id,
    name: row.name,
    site_address: row.site_address,
    is_public: row.is_public,
    archived_at: (row.archived_at as string | null) ?? null,
  };
});

const loadCompanySlug = cache(async (companyId: string): Promise<string | null> => {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('companies')
    .select('slug')
    .eq('id', companyId)
    .maybeSingle();
  return data?.slug ?? null;
});

/** 판정 순수 함수 (테스트 대상) — allowed 순서대로 처음 맞는 역할 */
export function decideProjectAccess(
  ctx: Pick<AccessContext, 'memberships' | 'participations'>,
  project: ProjectRow,
  allowed: ProjectAccess['as'][],
): { as: ProjectAccess['as']; canConfirm: boolean } | null {
  const member = ctx.memberships.find((m) => m.companyId === project.company_id);
  const parts = ctx.participations.filter((p) => p.projectId === project.id);
  for (const as of allowed) {
    if (as === 'editor') {
      const manager = member && (member.role === 'owner' || member.role === 'manager');
      const pm = member && parts.some((p) => p.role === 'pm');
      if (manager || pm) return { as, canConfirm: false };
    }
    if (as === 'customer') {
      const c = parts.find((p) => p.role === 'customer');
      if (c && project.is_public && !project.archived_at) return { as, canConfirm: c.canConfirm };
    }
    if (as === 'field') {
      if (parts.some((p) => p.role === 'field') && !project.archived_at)
        return { as, canConfirm: false };
    }
  }
  return null;
}

/** 존재 숨김 없이 결과만 돌려주는 버전 (Server Action 에서 fail('NOT_FOUND') 로 응답할 때) */
export async function findProjectAccess(
  projectId: string,
  allowed: ProjectAccess['as'][],
): Promise<ProjectAccess | null> {
  const ctx = await loadAccessContext();
  if (!ctx) return null;
  const project = await loadProjectBrief(projectId);
  if (!project) return null;
  const decided = decideProjectAccess(ctx, project, allowed);
  if (!decided) return null;
  const companySlug =
    ctx.memberships.find((m) => m.companyId === project.company_id)?.slug ??
    (await loadCompanySlug(project.company_id));
  if (!companySlug) return null;
  return {
    projectId: project.id,
    companyId: project.company_id,
    companySlug,
    as: decided.as,
    canConfirm: decided.canConfirm,
  };
}

/** 권한 없거나 없는 프로젝트 → notFound() (존재 숨김, POL-001) */
export async function requireProjectAccess(
  projectId: string,
  allowed: ProjectAccess['as'][],
): Promise<ProjectAccess> {
  await getAccessContext(); // 미로그인은 로그인으로
  const access = await findProjectAccess(projectId, allowed);
  if (access) return access;
  // 담당자의 고객 화면 미리보기 (페이지 렌더 전용 · 읽기 전용) — customer-preview.ts
  if (allowed.includes('customer')) {
    const { findCustomerPreview } = await import('./customer-preview');
    const preview = await findCustomerPreview(projectId);
    if (preview) return preview;
  }
  notFound();
}

/** URL·폼의 업체 주소명 정규화 (대소문자·퍼센트 인코딩 무시). 잘못된 인코딩은 null */
export function normalizeSlug(raw: string | undefined | null): string | null {
  if (!raw) return null;
  try {
    return decodeURIComponent(raw).toLowerCase();
  } catch {
    return null;
  }
}

/** A-09: 주소명으로 소속 찾기 — 대소문자가 달라도 같은 업체 (반환값의 slug 가 정규 주소명) */
export function findMembershipBySlug<T extends { slug: string }>(
  memberships: readonly T[],
  rawSlug: string | undefined | null,
): T | undefined {
  const slug = normalizeSlug(rawSlug);
  if (!slug) return undefined;
  return memberships.find((x) => x.slug.toLowerCase() === slug);
}

/**
 * 업체 구성원이 아니면 notFound().
 * A-09: 정규 주소명(slug, DB 값)을 함께 돌려준다 — 화면은 링크·숨은 필드에 URL 원문 대신 이것을 쓴다.
 */
export async function requireCompanyStaff(
  companySlug: string,
): Promise<{ companyId: string; role: MemberRole; slug: string }> {
  const ctx = await getAccessContext();
  const m = findMembershipBySlug(ctx.memberships, companySlug);
  if (!m) notFound();
  return { companyId: m.companyId, role: m.role, slug: m.slug };
}

export const isManagerRole = (role: MemberRole) => role === 'owner' || role === 'manager';

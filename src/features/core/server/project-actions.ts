'use server';
// src/features/core/server/project-actions.ts (A · TASK-005·007·012) — 프로젝트 생성·수정·고객 홈·보관
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { fail, ok, type ActionResult } from '@/shared/contracts/errors';
import { routes } from '@/shared/contracts/routes';
import { dbFail, formToObject, parseInput } from '@/shared/lib/action';
import {
  homeUpdateSchema,
  projectArchiveSchema,
  projectCreateSchema,
  projectUpdateSchema,
} from '../schema';
import { findMembershipBySlug, findProjectAccess, loadAccessContext } from './access';

function revalidateProject(slug: string, projectId: string) {
  revalidatePath(routes.app.projects(slug));
  revalidatePath(routes.app.project(slug, projectId, 'overview'));
  revalidatePath(routes.app.project(slug, projectId, 'settings'));
  revalidatePath(routes.portal.projects());
  revalidatePath(routes.portal.project(projectId, 'home'));
}

// ── REQ-011 프로젝트 생성 (생성자 pm 자동 배정·안내문 템플릿·기본 비공개는 DB 트리거) ─────
// 정책 메모(CR-A-07): 업체 구성원이면 PM 도 생성할 수 있다 — RLS projects insert 정책과 같다.
export async function createProject(
  _prev: ActionResult<never> | null,
  form: FormData,
): Promise<ActionResult<never>> {
  const raw = formToObject(form);
  const ctx = await loadAccessContext();
  if (!ctx) return fail('UNAUTHENTICATED');
  // A-09: `/app/MyCo/...` 처럼 대소문자가 달라도 같은 업체 — 경로는 정규 주소명(member.slug)으로
  const member = findMembershipBySlug(ctx.memberships, raw.companySlug);
  if (!member) return fail('NOT_FOUND');

  const parsed = parseInput(projectCreateSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;

  const supabase = await createServerSupabase();
  const { error } = await supabase.from('projects').insert({
    id: v.id,
    company_id: member.companyId,
    name: v.name,
    site_address: v.siteAddress,
    start_date: v.startDate,
    end_date: v.endDate,
    status: v.status,
    created_by: ctx.userId,
  });
  if (error && error.code !== '23505') {
    return dbFail('project.create.failed', error, {
      userId: ctx.userId,
      companyId: member.companyId,
    });
  }
  if (error) {
    // POL-038: 같은 id 재시도(23505)는 이미 만들어진 행을 성공으로 본다 —
    // A-09: 단, 그 행이 이 업체의 것이고 내가 볼 수 있을 때만 (다른 업체 id 충돌을 성공으로 숨기지 않음)
    const { data: existing, error: readError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', v.id)
      .eq('company_id', member.companyId)
      .maybeSingle();
    if (readError)
      return dbFail('project.create.recheck_failed', readError, {
        userId: ctx.userId,
        companyId: member.companyId,
      });
    if (!existing) return fail('CONFLICT');
  }
  revalidatePath(routes.app.projects(member.slug));
  redirect(routes.app.project(member.slug, v.id)); // TR-01 처럼 바로 PM-03
}

// ── REQ-017 기본 정보·현재 공정·고객 공개 ───────────────────────────────
export async function updateProject(
  _prev: ActionResult<{ version: number }> | null,
  form: FormData,
): Promise<ActionResult<{ version: number }>> {
  const parsed = parseInput(projectUpdateSchema, formToObject(form));
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const access = await findProjectAccess(v.projectId, ['editor']);
  if (!access) return fail('NOT_FOUND');

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('projects')
    .update({
      name: v.name,
      site_address: v.siteAddress,
      start_date: v.startDate,
      end_date: v.endDate,
      status: v.status,
      current_phase: v.currentPhase,
      is_public: v.isPublic,
    })
    .eq('id', v.projectId)
    .eq('version', v.baseVersion)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('project.update.failed', error, { projectId: v.projectId });
  if (!data) return fail('VERSION_CONFLICT');
  revalidateProject(access.companySlug, v.projectId);
  return ok({ version: data.version });
}

// ── REQ-014 고객 홈 편집 (안내문 + 4영역 순서·표시 + 테마·커버, 저장 즉시 반영) ─────────────
export async function updateHome(raw: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = parseInput(homeUpdateSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const access = await findProjectAccess(v.projectId, ['editor']);
  if (!access) return fail('NOT_FOUND');

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('projects')
    .update({
      home_message: v.homeMessage,
      home_sections: v.homeSections,
      home_theme: v.homeTheme,
      home_cover_file_id: v.homeCoverFileId,
    })
    .eq('id', v.projectId)
    .eq('version', v.baseVersion)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('project.home.failed', error, { projectId: v.projectId });
  if (!data) return fail('VERSION_CONFLICT');
  revalidateProject(access.companySlug, v.projectId);
  return ok({ version: data.version });
}

// ── REQ-019 보관·복원 (DELETE 없음, POL-020) ───────────────────────────
export async function setProjectArchived(raw: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = parseInput(projectArchiveSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const access = await findProjectAccess(v.projectId, ['editor']);
  if (!access) return fail('NOT_FOUND');

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('projects')
    .update({ archived_at: v.archive ? new Date().toISOString() : null })
    .eq('id', v.projectId)
    .eq('version', v.baseVersion)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('project.archive.failed', error, { projectId: v.projectId });
  if (!data) return fail('VERSION_CONFLICT');
  revalidateProject(access.companySlug, v.projectId);
  return ok({ version: data.version });
}

'use server';
// src/features/core/server/client-actions.ts (A · TASK-013) — 고객 카드 등록·수정·프로젝트 연결·보관 (REQ-021)
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { fail, ok, type ActionResult } from '@/shared/contracts/errors';
import { routes } from '@/shared/contracts/routes';
import { dbFail, formToObject, parseInput } from '@/shared/lib/action';
import {
  clientArchiveSchema,
  clientCreateSchema,
  clientLinkSchema,
  clientUnlinkSchema,
  clientUpdateSchema,
} from '../schema';
import { findMembershipBySlug, findProjectAccess, loadAccessContext } from './access';

async function staffOf(slug: string | undefined) {
  const ctx = await loadAccessContext();
  // A-09: 대소문자가 달라도 같은 업체 — 이후 경로·revalidate 는 정규 주소명(m.slug)으로
  const m = ctx ? findMembershipBySlug(ctx.memberships, slug) : undefined;
  return ctx && m ? { ctx, m } : null;
}

export async function createClient(
  _prev: ActionResult<never> | null,
  form: FormData,
): Promise<ActionResult<never>> {
  const raw = formToObject(form);
  const staff = await staffOf(raw.companySlug);
  if (!staff) return fail('NOT_FOUND');
  const parsed = parseInput(clientCreateSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const supabase = await createServerSupabase();
  const { error } = await supabase.from('clients').insert({
    id: v.id,
    company_id: staff.m.companyId,
    name: v.name,
    phone: v.phone,
    email: v.email,
    memo: v.memo,
    created_by: staff.ctx.userId,
  });
  if (error && error.code !== '23505')
    return dbFail('client.create.failed', error, { companyId: staff.m.companyId });
  if (error) {
    // POL-038: 같은 id 재시도(23505)는 이미 만들어진 행을 성공으로 본다 —
    // 단, 그 행이 이 업체의 것이고 내가 볼 수 있을 때만 (다른 업체 id 충돌을 성공으로 숨기지 않음, createProject 와 같음)
    const { data: existing, error: readError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', v.id)
      .eq('company_id', staff.m.companyId)
      .maybeSingle();
    if (readError)
      return dbFail('client.create.recheck_failed', readError, { companyId: staff.m.companyId });
    if (!existing) return fail('CONFLICT');
  }
  revalidatePath(routes.app.clients(staff.m.slug));
  redirect(routes.app.client(staff.m.slug, v.id));
}

export async function updateClient(
  _prev: ActionResult<{ version: number }> | null,
  form: FormData,
): Promise<ActionResult<{ version: number }>> {
  const raw = formToObject(form);
  const staff = await staffOf(raw.companySlug);
  if (!staff) return fail('NOT_FOUND');
  const parsed = parseInput(clientUpdateSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('clients')
    .update({ name: v.name, phone: v.phone, email: v.email, memo: v.memo })
    .eq('id', v.id)
    .eq('company_id', staff.m.companyId)
    .eq('version', v.baseVersion)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('client.update.failed', error, { objectId: v.id });
  if (!data) return fail('VERSION_CONFLICT');
  revalidatePath(routes.app.client(staff.m.slug, v.id));
  revalidatePath(routes.app.clients(staff.m.slug));
  return ok({ version: data.version });
}

/**
 * 프로젝트 연결 — 편집 가능한 프로젝트만, 프로젝트당 유효 카드 1개 (부분 unique → CONFLICT)
 * A-11: 카드가 그 프로젝트와 같은 업체인지 앱에서 먼저 확인 (DB 트리거가 최종 차단)
 */
export async function linkClientProject(raw: unknown): Promise<ActionResult<null>> {
  const parsed = parseInput(clientLinkSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const access = await findProjectAccess(v.projectId, ['editor']);
  if (!access) return fail('NOT_FOUND');
  const supabase = await createServerSupabase();
  const { data: client, error: readError } = await supabase
    .from('clients')
    .select('id, archived_at')
    .eq('id', v.clientId)
    .eq('company_id', access.companyId)
    .maybeSingle();
  if (readError) return dbFail('client.link.read_failed', readError, { objectId: v.clientId });
  if (!client) return fail('NOT_FOUND');
  if (client.archived_at) return fail('CONFLICT'); // 보관된 카드에는 새로 연결하지 않는다
  const { error } = await supabase.from('client_projects').insert({
    company_id: access.companyId,
    client_id: v.clientId,
    project_id: v.projectId,
  });
  if (error) return dbFail('client.link.failed', error, { projectId: v.projectId });
  revalidatePath(routes.app.client(access.companySlug, v.clientId));
  return ok(null);
}

/**
 * DB-08: 프로젝트 연결 해제 = 유효 연결의 archived_at 설정 (삭제 없음, P-05). 그 프로젝트 편집자만.
 * 해제 뒤 같은 프로젝트를 다른 카드(또는 같은 카드)에 다시 연결할 수 있다.
 */
export async function unlinkClientProject(raw: unknown): Promise<ActionResult<null>> {
  const parsed = parseInput(clientUnlinkSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const access = await findProjectAccess(v.projectId, ['editor']);
  if (!access) return fail('NOT_FOUND');
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('client_projects')
    .update({ archived_at: new Date().toISOString() })
    .eq('client_id', v.clientId)
    .eq('project_id', v.projectId)
    .eq('company_id', access.companyId)
    .is('archived_at', null)
    .select('id')
    .maybeSingle();
  if (error) return dbFail('client.unlink.failed', error, { projectId: v.projectId });
  if (!data) return fail('NOT_FOUND');
  revalidatePath(routes.app.client(access.companySlug, v.clientId));
  return ok(null);
}

export async function setClientArchived(
  slug: string,
  raw: unknown,
): Promise<ActionResult<{ version: number }>> {
  const staff = await staffOf(slug);
  if (!staff) return fail('NOT_FOUND');
  const parsed = parseInput(clientArchiveSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('clients')
    .update({ archived_at: v.archive ? new Date().toISOString() : null })
    .eq('id', v.clientId)
    .eq('company_id', staff.m.companyId)
    .eq('version', v.baseVersion)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('client.archive.failed', error, { objectId: v.clientId });
  if (!data) return fail('VERSION_CONFLICT');
  revalidatePath(routes.app.client(staff.m.slug, v.clientId));
  revalidatePath(routes.app.clients(staff.m.slug));
  return ok({ version: data.version });
}

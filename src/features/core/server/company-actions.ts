'use server';
// src/features/core/server/company-actions.ts (A · TASK-015·016) — 업체 정보·로고·기본 템플릿 (POL-030: owner/manager)
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { fail, ok, type ActionResult } from '@/shared/contracts/errors';
import { routes } from '@/shared/contracts/routes';
import { dbFail, formToObject, parseInput } from '@/shared/lib/action';
import { companyLogoSchema, companyUpdateSchema, templateUpdateSchema } from '../schema';
import { loadAccessContext } from './access';

type Membership = { companyId: string; slug: string; role: string };

async function managerOf(
  companyId: string,
): Promise<{ ok: true; m: Membership } | { ok: false; error: ActionResult<never> }> {
  const ctx = await loadAccessContext();
  const m = ctx?.memberships.find((x) => x.companyId === companyId);
  if (!m) return { ok: false, error: fail('NOT_FOUND') };
  if (m.role !== 'owner' && m.role !== 'manager') return { ok: false, error: fail('FORBIDDEN') };
  return { ok: true, m };
}

export async function updateCompany(
  _prev: ActionResult<{ version: number }> | null,
  form: FormData,
): Promise<ActionResult<{ version: number }>> {
  const parsed = parseInput(companyUpdateSchema, formToObject(form));
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const auth = await managerOf(v.companyId);
  if (!auth.ok) return auth.error;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('companies')
    .update({ name: v.name })
    .eq('id', v.companyId)
    .eq('version', v.baseVersion)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('company.update.failed', error, { companyId: v.companyId });
  if (!data) return fail('VERSION_CONFLICT');
  revalidatePath(routes.app.settings(auth.m.slug, 'company'));
  revalidatePath(`/app/${auth.m.slug}`, 'layout');
  return ok({ version: data.version });
}

/** 로고 연결 — 파일은 B 어댑터(개발 중 STUB)로 올린 company_logo, DB 트리거 company_logo_check 가 검사 */
export async function setCompanyLogo(raw: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = parseInput(companyLogoSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const auth = await managerOf(v.companyId);
  if (!auth.ok) return auth.error;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('companies')
    .update({ logo_file_id: v.fileId })
    .eq('id', v.companyId)
    .eq('version', v.baseVersion)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('company.logo.failed', error, { companyId: v.companyId });
  if (!data) return fail('VERSION_CONFLICT');
  revalidatePath(`/app/${auth.m.slug}`, 'layout');
  return ok({ version: data.version });
}

/** REQ-052 기본 템플릿 (안내문 + 4영역 + 테마 + 커버) — 커버 파일은 DB 트리거 company_settings_cover_check 가 검사 */
export async function updateTemplate(raw: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = parseInput(templateUpdateSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const auth = await managerOf(v.companyId);
  if (!auth.ok) return auth.error;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('company_settings')
    .update({
      default_home_message: v.defaultHomeMessage,
      default_home_sections: v.defaultHomeSections,
      default_home_theme: v.defaultHomeTheme,
      default_home_cover_file_id: v.defaultHomeCoverFileId,
    })
    .eq('company_id', v.companyId)
    .eq('version', v.baseVersion)
    .select('version')
    .maybeSingle();
  if (error) return dbFail('company.template.failed', error, { companyId: v.companyId });
  if (!data) return fail('VERSION_CONFLICT');
  revalidatePath(routes.app.settings(auth.m.slug, 'templates'));
  return ok({ version: data.version });
}

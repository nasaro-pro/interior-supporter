'use server';
// 시공팀 열람 설정 저장 (F2·F9) — 담당자(편집권자)만. 순서: 입력 검증 → 접근 검사 → upsert(RLS 재검사) → 화면 갱신
import { revalidatePath } from 'next/cache';
import { requireProjectAccess } from '@/features/core';
import { ok, type ActionResult } from '@/shared/contracts/errors';
import { routes } from '@/shared/contracts/routes';
import { dbFail, parseInput } from '@/shared/lib/action';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { fieldAccessSchema } from '../schema';

export async function saveFieldAccess(raw: unknown): Promise<ActionResult<void>> {
  const parsed = parseInput(fieldAccessSchema, raw);
  if (!parsed.ok) return parsed.result;
  const input = parsed.data;
  const access = await requireProjectAccess(input.projectId, ['editor']);
  const supabase = await createServerSupabase();
  // company_id 는 DB scope 트리거가 프로젝트에서 채운다
  const { error } = await supabase.from('project_field_settings').upsert(
    {
      project_id: input.projectId,
      company_id: access.companyId,
      show_schedule: input.showSchedule,
      show_designs: input.showDesigns,
      show_materials: input.showMaterials,
      photo_auto_public: input.photoAutoPublic,
    },
    { onConflict: 'project_id' },
  );
  if (error) return dbFail('field.access_save.failed', error, { projectId: input.projectId });
  revalidatePath(routes.app.project(access.companySlug, input.projectId, 'settings'));
  revalidatePath(routes.field.home());
  return ok(undefined);
}

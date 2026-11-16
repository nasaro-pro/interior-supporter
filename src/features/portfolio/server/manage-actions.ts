'use server';
// 포트폴리오 관리 탭(PM-65) 보조 액션 — 프로젝트 사진 목록(사례 추가 Sheet), 순서 바꾸기
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { fail, ok, type ActionResult } from '@/shared/contracts/errors';
import { dbFail, parseInput } from '@/shared/lib/action';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { portfolioRoutes } from '../routes';
import { requirePortfolioLevel } from './access';

export interface ProjectImageOption {
  fileId: string;
  kind: 'photo_original' | 'design_preview' | 'material_image';
  name: string;
  /** 목록에 보여 줄 작은 그림 (사진은 썸네일 파일, 나머지는 원본) — /api/files 로 연다 */
  previewFileId: string;
  createdAt: string;
}

const listSchema = z.object({ companyId: z.uuid(), projectId: z.guid() });

/** 사례 추가: 고른 프로젝트의 이미지(현장 사진·도안 이미지·자재 이미지) — 원본 권한 그대로(RLS) */
export async function listProjectImages(raw: unknown): Promise<ActionResult<ProjectImageOption[]>> {
  const parsed = parseInput(listSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const auth = await requirePortfolioLevel(v.companyId, 'works');
  if (!auth.ok) return auth.error;
  // '사례 올리기' 단계는 자기 담당 프로젝트 사진만
  if (auth.a.level === 'works' && !auth.a.myProjectIds.has(v.projectId)) return fail('FORBIDDEN');
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('files')
    .select('id, kind, original_name, created_at')
    .eq('company_id', v.companyId)
    .eq('project_id', v.projectId)
    .eq('status', 'ready')
    .in('kind', ['photo_original', 'design_preview', 'material_image'])
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return dbFail('portfolio.project_images.failed', error, { projectId: v.projectId });
  const rows = data ?? [];
  const photoIds = rows.filter((r) => r.kind === 'photo_original').map((r) => r.id);
  const { data: thumbs } = photoIds.length
    ? await supabase
        .from('files')
        .select('id, derived_from')
        .eq('kind', 'photo_thumb')
        .in('derived_from', photoIds)
    : { data: [] as { id: string; derived_from: string | null }[] };
  const thumbOf = new Map((thumbs ?? []).map((t) => [t.derived_from, t.id]));
  return ok(
    rows.map((r) => ({
      fileId: r.id,
      kind: r.kind as ProjectImageOption['kind'],
      name: r.original_name,
      previewFileId: thumbOf.get(r.id) ?? r.id,
      createdAt: r.created_at,
    })),
  );
}

const reorderSchema = z.object({
  companyId: z.uuid(),
  items: z
    .array(
      z.object({
        id: z.guid(),
        baseVersion: z.number().int().positive(),
        sortOrder: z.number().int().min(0).max(9999),
      }),
    )
    .min(1)
    .max(200),
});

/** 순서 바꾸기 — 바뀐 사례만 저장(낙관적 잠금). 하나라도 충돌하면 VERSION_CONFLICT → 화면이 최신을 다시 불러옴 */
export async function reorderWorks(raw: unknown): Promise<ActionResult<void>> {
  const parsed = parseInput(reorderSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const auth = await requirePortfolioLevel(v.companyId, 'full'); // 순서 = 공개 페이지 순서 → 전체 관리만
  if (!auth.ok) return auth.error;
  const supabase = await createServerSupabase();
  const { data: current } = await supabase
    .from('portfolio_works')
    .select('id, sort_order')
    .eq('company_id', v.companyId)
    .in(
      'id',
      v.items.map((i) => i.id),
    );
  const now = new Map((current ?? []).map((c) => [c.id, c.sort_order]));
  for (const item of v.items) {
    if (now.get(item.id) === item.sortOrder) continue;
    const { data, error } = await supabase
      .from('portfolio_works')
      .update({ sort_order: item.sortOrder })
      .eq('id', item.id)
      .eq('company_id', v.companyId)
      .eq('version', item.baseVersion)
      .select('id')
      .maybeSingle();
    if (error) return dbFail('portfolio.reorder.failed', error, { objectId: item.id });
    if (!data) return fail('VERSION_CONFLICT');
  }
  revalidatePath(portfolioRoutes.settings(auth.a.slug));
  revalidatePath(portfolioRoutes.home(auth.a.slug));
  return ok(undefined);
}

export interface EditImage {
  id: string;
  version: number;
  sourceFileId: string;
  thumbPath: string;
  space: string | null;
  spaceLabel: string;
  caption: string;
  role: 'gallery' | 'before' | 'after';
}

export interface EditWork {
  id: string;
  version: number;
  projectId: string | null;
  title: string;
  areaLabel: string;
  sizePyeong: number | null;
  durationWeeks: number | null;
  completedOn: string | null;
  spaces: string[];
  summary: string;
  coverImageId: string | null;
  status: 'draft' | 'published';
  images: EditImage[];
}

const editRefSchema = z.object({ companyId: z.uuid(), workId: z.guid() });

/** 수정 화면: 사례 한 건 + 사진 (보관 안 된 것). 읽기는 직원 권한(RLS), 쓰기는 각 액션이 다시 확인 */
export async function loadWorkForEdit(raw: unknown): Promise<ActionResult<EditWork>> {
  const parsed = parseInput(editRefSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const auth = await requirePortfolioLevel(v.companyId, 'works');
  if (!auth.ok) return auth.error;
  const supabase = await createServerSupabase();
  const [{ data: w, error }, { data: imgs, error: imgError }] = await Promise.all([
    supabase
      .from('portfolio_works')
      .select(
        'id, version, project_id, title, area_label, size_pyeong, duration_weeks, completed_on, spaces, summary, cover_image_id, status',
      )
      .eq('id', v.workId)
      .eq('company_id', v.companyId)
      .is('archived_at', null)
      .maybeSingle(),
    supabase
      .from('portfolio_images')
      .select('id, version, source_file_id, thumb_path, space, space_label, caption, role')
      .eq('work_id', v.workId)
      .is('archived_at', null)
      .order('sort_order')
      .order('created_at'),
  ]);
  if (error) return dbFail('portfolio.edit.load_failed', error, { objectId: v.workId });
  if (imgError) return dbFail('portfolio.edit.images_failed', imgError, { objectId: v.workId });
  if (!w) return fail('NOT_FOUND');
  return ok({
    id: w.id,
    version: w.version,
    projectId: w.project_id,
    title: w.title,
    areaLabel: w.area_label,
    sizePyeong: w.size_pyeong === null ? null : Number(w.size_pyeong),
    durationWeeks: w.duration_weeks,
    completedOn: w.completed_on,
    spaces: w.spaces ?? [],
    summary: w.summary,
    coverImageId: w.cover_image_id,
    status: w.status,
    images: (imgs ?? []).map((i) => ({
      id: i.id,
      version: i.version,
      sourceFileId: i.source_file_id,
      thumbPath: i.thumb_path,
      space: i.space,
      spaceLabel: i.space_label,
      caption: i.caption,
      role: i.role,
    })),
  });
}

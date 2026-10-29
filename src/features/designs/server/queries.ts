// 도안 조회 (Server Component 전용). 고객 필터는 RLS(row_visible_*)가 한다 — 별도 공개 필터를 또 만들지 않는다
import 'server-only';
import { notFound } from 'next/navigation';
import { PAGE_SIZE } from '@/shared/contracts/domain';
import type { ProjectAccess } from '@/shared/contracts/integration';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { listConfirmations } from '@/features/designs/server/confirmations';
import type {
  DesignDetail,
  DesignFileInfo,
  DesignListItem,
  DesignPreviewItem,
} from '@/features/designs/types';

/** 브라우저에서 바로 보여 줄 수 있는 원본 이미지 형식 */
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function listDesigns(
  projectId: string,
  viewer: ProjectAccess,
  opts: { archived?: boolean; limit?: number } = {},
): Promise<{ items: DesignListItem[]; hasMore: boolean }> {
  const supabase = await createServerSupabase();
  const limit = opts.limit ?? PAGE_SIZE;
  let q = supabase
    .from('designs')
    .select(
      'id, title, current_version, is_public, confirm_state, updated_at, archived_at, space, is_main, sort_order',
    )
    .eq('project_id', projectId)
    // D-28: 디자이너가 정한 순서, 같으면 최근 수정순 (공간 묶음 · 대표 먼저는 lib/order.ts)
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);
  // 보관함은 편집자만 (고객은 RLS 가 보관 항목을 숨긴다)
  q =
    viewer.as === 'editor' && opts.archived
      ? q.not('archived_at', 'is', null)
      : q.is('archived_at', null);
  const { data, error } = await q;
  if (error) throw new Error(`designs.list:${error.code}`);
  const rows = (data ?? []).slice(0, limit);

  // 목록 미리보기: 현재 버전 또는 도안 전체에 연결된 첫 비교 이미지
  const previewByDesign = new Map<string, string>();
  if (rows.length) {
    const { data: previews, error: previewError } = await supabase
      .from('design_previews')
      .select('design_id, file_id, created_at')
      .in(
        'design_id',
        rows.map((r) => r.id),
      )
      .is('archived_at', null)
      .order('created_at', { ascending: true });
    // B-10: 하위 조회 실패를 '미리보기 없음'으로 삼키지 않는다 → error.tsx(ErrorState)
    if (previewError) throw new Error(`designs.list.previews:${previewError.code}`);
    for (const p of previews ?? []) {
      if (!previewByDesign.has(p.design_id)) previewByDesign.set(p.design_id, p.file_id);
    }
    // 비교 이미지가 없으면 현재 버전 원본이 이미지(JPG·PNG·WebP)일 때 그 원본을 대신 보여 준다
    const missing = rows.filter((r) => !previewByDesign.has(r.id));
    if (missing.length) {
      const { data: versions, error: versionError } = await supabase
        .from('design_versions')
        .select('design_id, version_no, file_id')
        .in(
          'design_id',
          missing.map((r) => r.id),
        );
      if (versionError) throw new Error(`designs.list.versions:${versionError.code}`);
      const currentNo = new Map(missing.map((r) => [r.id, r.current_version]));
      const currentFile = new Map(
        (versions ?? [])
          .filter((v) => currentNo.get(v.design_id) === v.version_no)
          .map((v) => [v.design_id, v.file_id]),
      );
      if (currentFile.size) {
        const { data: files, error: fileError } = await supabase
          .from('files')
          .select('id, mime')
          .in('id', [...currentFile.values()]);
        if (fileError) throw new Error(`designs.list.files:${fileError.code}`);
        const images = new Set(
          (files ?? []).filter((f) => IMAGE_MIMES.has(f.mime)).map((f) => f.id),
        );
        for (const [designId, fileId] of currentFile) {
          if (images.has(fileId)) previewByDesign.set(designId, fileId);
        }
      }
    }
  }
  return {
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      currentVersion: r.current_version,
      isPublic: r.is_public,
      confirmState: r.confirm_state,
      updatedAt: r.updated_at,
      archivedAt: r.archived_at,
      previewFileId: previewByDesign.get(r.id) ?? null,
      space: r.space,
      isMain: r.is_main,
      sortOrder: r.sort_order,
    })),
    hasMore: (data ?? []).length > limit,
  };
}

export interface ComparablePreview {
  id: string;
  fileId: string;
  label: string;
  designId: string;
  designTitle: string;
  versionNo: number | null;
  pdfPage: number | null;
}

/**
 * A/B 비교 후보 (REQ-105): 같은 프로젝트에서 호출자가 볼 수 있는 비교 이미지 전부.
 * 고객은 RLS 가 공개 도안의 현재 버전분만 돌려준다 → "두 이미지 모두 공개" 조건이 자동으로 지켜진다 (B-T05).
 */
export async function listComparablePreviews(projectId: string): Promise<ComparablePreview[]> {
  const supabase = await createServerSupabase();
  const { data: previews, error } = await supabase
    .from('design_previews')
    .select('id, file_id, label, pdf_page, design_id, design_version_id, created_at')
    .eq('project_id', projectId)
    .is('archived_at', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`design_previews.list:${error.code}`);
  if (!previews?.length) return [];
  const designIds = [...new Set(previews.map((p) => p.design_id))];
  const versionIds = previews.flatMap((p) => (p.design_version_id ? [p.design_version_id] : []));
  const [designsRes, versionsRes] = await Promise.all([
    supabase.from('designs').select('id, title').in('id', designIds).is('archived_at', null),
    versionIds.length
      ? supabase.from('design_versions').select('id, version_no').in('id', versionIds)
      : Promise.resolve({ data: [] as { id: string; version_no: number }[], error: null }),
  ]);
  if (designsRes.error) throw new Error(`design_previews.list.designs:${designsRes.error.code}`);
  if (versionsRes.error) throw new Error(`design_previews.list.versions:${versionsRes.error.code}`);
  const designs = designsRes.data;
  const versions = versionsRes.data;
  const titles = new Map((designs ?? []).map((d) => [d.id, d.title]));
  const versionNos = new Map((versions ?? []).map((v) => [v.id, v.version_no]));
  return previews.flatMap((p) => {
    const designTitle = titles.get(p.design_id);
    if (designTitle === undefined) return []; // 보관된 도안의 이미지는 후보에서 뺀다
    return [
      {
        id: p.id,
        fileId: p.file_id,
        label: p.label,
        designId: p.design_id,
        designTitle,
        versionNo: p.design_version_id ? (versionNos.get(p.design_version_id) ?? null) : null,
        pdfPage: p.pdf_page,
      },
    ];
  });
}

/** 없거나 볼 수 없으면 notFound() — 상세를 먼저 그리지 않는다 (존재 숨김) */
export async function getDesignDetail(projectId: string, designId: string): Promise<DesignDetail> {
  const supabase = await createServerSupabase();
  const { data: d, error } = await supabase
    .from('designs')
    .select(
      'id, title, description, is_public, confirm_state, current_version, version, updated_at, archived_at, space, is_main',
    )
    .eq('id', designId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (error && error.code !== '22P02') throw new Error(`designs.detail:${error.code}`);
  if (!d) notFound();

  const [versionsRes, previewsRes, confirmations] = await Promise.all([
    // 고객은 RLS 가 현재 버전만 돌려준다 (POL-014)
    supabase
      .from('design_versions')
      .select('id, version_no, note, created_at, file_id')
      .eq('design_id', d.id)
      .order('version_no', { ascending: false }),
    supabase
      .from('design_previews')
      .select('id, file_id, label, pdf_page, design_version_id, created_at')
      .eq('design_id', d.id)
      .is('archived_at', null)
      .order('created_at', { ascending: true }),
    listConfirmations('designs', d.id),
  ]);
  // B-10: 버전·비교 이미지 조회 실패를 빈 목록으로 보이지 않는다
  if (versionsRes.error) throw new Error(`designs.detail.versions:${versionsRes.error.code}`);
  if (previewsRes.error) throw new Error(`designs.detail.previews:${previewsRes.error.code}`);
  const versions = versionsRes.data;
  const previews = previewsRes.data;

  const fileIds = [
    ...(versions ?? []).map((v) => v.file_id),
    ...(previews ?? []).map((p) => p.file_id),
  ];
  const files = new Map<string, DesignFileInfo & { width: number | null; height: number | null }>();
  if (fileIds.length) {
    const { data: rows, error: filesError } = await supabase
      .from('files')
      .select('id, original_name, mime, size_bytes, width, height')
      .in('id', fileIds);
    if (filesError) throw new Error(`designs.detail.files:${filesError.code}`);
    for (const f of rows ?? []) {
      files.set(f.id, {
        id: f.id,
        name: f.original_name,
        mime: f.mime,
        sizeBytes: f.size_bytes,
        width: f.width,
        height: f.height,
      });
    }
  }
  const versionNoById = new Map((versions ?? []).map((v) => [v.id, v.version_no]));

  return {
    id: d.id,
    title: d.title,
    description: d.description,
    isPublic: d.is_public,
    confirmState: d.confirm_state,
    currentVersion: d.current_version,
    version: d.version,
    updatedAt: d.updated_at,
    archivedAt: d.archived_at,
    space: d.space,
    isMain: d.is_main,
    versions: (versions ?? []).map((v) => {
      const f = files.get(v.file_id);
      return {
        id: v.id,
        versionNo: v.version_no,
        note: v.note,
        createdAt: v.created_at,
        file: f ? { id: f.id, name: f.name, mime: f.mime, sizeBytes: f.sizeBytes } : null,
      };
    }),
    previews: (previews ?? []).map((p): DesignPreviewItem => ({
      id: p.id,
      fileId: p.file_id,
      label: p.label,
      pdfPage: p.pdf_page,
      designVersionId: p.design_version_id,
      versionNo: p.design_version_id ? (versionNoById.get(p.design_version_id) ?? null) : null,
      width: files.get(p.file_id)?.width ?? null,
      height: files.get(p.file_id)?.height ?? null,
    })),
    confirmations,
  };
}

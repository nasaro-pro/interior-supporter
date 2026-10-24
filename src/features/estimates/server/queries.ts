// 견적 조회 — 고객은 RLS 로 공개 버전이 있는 견적·공개 버전만 받는다 (POL-015)
import 'server-only';
import { notFound } from 'next/navigation';
import { PAGE_SIZE } from '@/shared/contracts/domain';
import type { ProjectAccess } from '@/shared/contracts/integration';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import type {
  EstimateDetail,
  EstimateListItem,
  EstimateVersionItem,
} from '@/features/estimates/types';

export async function listEstimates(
  projectId: string,
  viewer: ProjectAccess,
  opts: { archived?: boolean; limit?: number } = {},
): Promise<{ items: EstimateListItem[]; hasMore: boolean }> {
  const supabase = await createServerSupabase();
  const limit = opts.limit ?? PAGE_SIZE;
  let q = supabase
    .from('estimates')
    .select('id, title, updated_at, archived_at')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);
  q =
    viewer.as === 'editor' && opts.archived
      ? q.not('archived_at', 'is', null)
      : q.is('archived_at', null);
  const { data, error } = await q;
  if (error) throw new Error(`estimates.list:${error.code}`);
  const rows = (data ?? []).slice(0, limit);
  const versionsByEstimate = new Map<
    string,
    { version_no: number; version_label: string; is_public: boolean; created_at: string }[]
  >();
  if (rows.length) {
    const { data: versions, error: vError } = await supabase
      .from('estimate_versions')
      .select('estimate_id, version_no, version_label, is_public, created_at')
      .in(
        'estimate_id',
        rows.map((r) => r.id),
      )
      .is('archived_at', null)
      .order('version_no', { ascending: false });
    // B-10: 버전 조회 실패를 '버전 없음'으로 보이지 않는다
    if (vError) throw new Error(`estimates.list.versions:${vError.code}`);
    for (const v of versions ?? []) {
      const list = versionsByEstimate.get(v.estimate_id) ?? [];
      list.push(v);
      versionsByEstimate.set(v.estimate_id, list);
    }
  }
  return {
    items: rows.map((e) => {
      const vs = versionsByEstimate.get(e.id) ?? [];
      const latest = vs[0];
      return {
        id: e.id,
        title: e.title,
        updatedAt: e.updated_at,
        archivedAt: e.archived_at,
        versionCount: vs.length,
        hasPublic: vs.some((v) => v.is_public),
        latest: latest
          ? {
              versionNo: latest.version_no,
              versionLabel: latest.version_label,
              isPublic: latest.is_public,
              createdAt: latest.created_at,
            }
          : null,
      };
    }),
    hasMore: (data ?? []).length > limit,
  };
}

/**
 * 견적 상세 + 버전. REQ-132: ?v=N 이 볼 수 없는 버전(비공개·없음)이면 상세를 그리지 않고 notFound (직접 링크 차단)
 */
export async function getEstimate(
  projectId: string,
  estimateId: string,
  versionNo: number | undefined,
): Promise<EstimateDetail> {
  const supabase = await createServerSupabase();
  const { data: e, error } = await supabase
    .from('estimates')
    .select('id, title, archived_at, version')
    .eq('id', estimateId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (error && error.code !== '22P02') throw new Error(`estimates.detail:${error.code}`);
  if (!e) notFound();

  const { data: rows, error: vError } = await supabase
    .from('estimate_versions')
    .select(
      'id, version_no, version_label, change_note, is_public, published_at, created_at, file_id, version',
    )
    .eq('estimate_id', e.id)
    .is('archived_at', null)
    .order('version_no', { ascending: false });
  if (vError) throw new Error(`estimate_versions.list:${vError.code}`);
  const fileIds = (rows ?? []).map((v) => v.file_id);
  const files = new Map<string, { name: string; size: number; sha256: string | null }>();
  if (fileIds.length) {
    const { data: fs, error: fError } = await supabase
      .from('files')
      .select('id, original_name, size_bytes, sha256')
      .in('id', fileIds);
    if (fError) throw new Error(`estimates.detail.files:${fError.code}`);
    for (const f of fs ?? [])
      files.set(f.id, { name: f.original_name, size: f.size_bytes, sha256: f.sha256 });
  }
  const versions: EstimateVersionItem[] = (rows ?? []).map((v) => ({
    id: v.id,
    versionNo: v.version_no,
    versionLabel: v.version_label,
    changeNote: v.change_note,
    isPublic: v.is_public,
    publishedAt: v.published_at,
    createdAt: v.created_at,
    fileId: v.file_id,
    fileName: files.get(v.file_id)?.name ?? null,
    sizeBytes: files.get(v.file_id)?.size ?? null,
    sha256: files.get(v.file_id)?.sha256 ?? null,
    version: v.version,
  }));
  let selected: EstimateVersionItem | null = versions[0] ?? null;
  if (versionNo !== undefined) {
    selected = versions.find((v) => v.versionNo === versionNo) ?? null;
    if (!selected) notFound();
  }
  return {
    id: e.id,
    title: e.title,
    archivedAt: e.archived_at,
    version: e.version,
    versions,
    selected,
  };
}

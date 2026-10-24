// photos 조회 — 권한은 RLS(row_visible_photos): 편집자 전체 / 시공팀 배정 현장 전체 / 고객 공개분만
import 'server-only';
import { logger } from '@/shared/lib/logger';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import type { ProjectAccess } from '@/shared/contracts/integration';
import type { PhotoItem, PhotoListFilters } from '../types';

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

const COLUMNS =
  'id, project_id, file_id, thumb_file_id, phase, captured_on, description, is_public, uploaded_by, uploader_role, created_at, archived_at, version';

interface PhotoRow {
  id: string;
  project_id: string;
  file_id: string;
  thumb_file_id: string | null;
  phase: PhotoItem['phase'];
  captured_on: string | null;
  description: string;
  is_public: boolean;
  uploaded_by: string;
  uploader_role: string;
  created_at: string;
  archived_at: string | null;
  version: number;
}

async function profileNames(supabase: Supabase, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const { data } = await supabase.from('profiles').select('id, display_name').in('id', unique);
  return new Map((data ?? []).map((p) => [p.id, p.display_name]));
}

function toItem(r: PhotoRow, names: Map<string, string>): PhotoItem {
  return {
    id: r.id,
    projectId: r.project_id,
    fileId: r.file_id,
    thumbFileId: r.thumb_file_id,
    phase: r.phase,
    capturedOn: r.captured_on,
    description: r.description,
    isPublic: r.is_public,
    uploaderId: r.uploaded_by,
    uploaderRole: r.uploader_role === 'field' ? 'field' : 'staff',
    uploaderName: names.get(r.uploaded_by) ?? null,
    createdAt: r.created_at,
    archived: r.archived_at !== null,
    version: r.version,
  };
}

export async function listPhotos(
  projectId: string,
  viewer: ProjectAccess,
  f: PhotoListFilters,
): Promise<{ items: PhotoItem[]; hasMore: boolean }> {
  const supabase = await createServerSupabase();
  let query = supabase.from('photos').select(COLUMNS).eq('project_id', projectId);
  // POL-004 이중 검증: 고객은 공개분만 (RLS 와 같은 조건)
  if (viewer.as === 'customer') query = query.eq('is_public', true);
  query = f.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
  if (f.phase) query = query.eq('phase', f.phase);
  if (f.from) query = query.gte('captured_on', f.from);
  if (f.to) query = query.lte('captured_on', f.to);
  if (f.uploader) query = query.eq('uploaded_by', f.uploader);
  const { data, error } = await query
    .order('captured_on', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(f.size + 1);
  if (error) throw new Error(`photos.list:${error.code ?? 'unknown'}`);
  const rows = (data ?? []) as PhotoRow[];
  const page = rows.slice(0, f.size);
  const names = await profileNames(
    supabase,
    page.map((r) => r.uploaded_by),
  );
  return { items: page.map((r) => toItem(r, names)), hasMore: rows.length > f.size };
}

const UPLOADER_SCAN_LIMIT = 1000;

/**
 * 업로더 필터 선택지 — 이 프로젝트에 내가 볼 수 있는 사진을 올린 사람 (C-02).
 * 목록(listPhotos)과 같은 조건: 고객은 공개분만(POL-004 이중 검증), 보관 탭 여부도 목록과 같게.
 * 최근 1000행만 훑는다 — 잘리면 경고 로그 + truncated=true (선택지가 일부일 수 있음).
 */
export async function listPhotoUploaders(
  projectId: string,
  viewer: ProjectAccess,
  opts: { archived: boolean },
): Promise<{ items: { id: string; name: string | null }[]; truncated: boolean }> {
  const supabase = await createServerSupabase();
  let query = supabase.from('photos').select('uploaded_by').eq('project_id', projectId);
  if (viewer.as === 'customer') query = query.eq('is_public', true);
  query = opts.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
  const { data } = await query.order('created_at', { ascending: false }).limit(UPLOADER_SCAN_LIMIT);
  const rows = data ?? [];
  const truncated = rows.length >= UPLOADER_SCAN_LIMIT;
  if (truncated) logger.warn('photos.uploaders.truncated', { projectId });
  const ids = [...new Set(rows.map((r) => r.uploaded_by))];
  const names = await profileNames(supabase, ids);
  const items = ids
    .map((id) => ({ id, name: names.get(id) ?? null }))
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ko'));
  return { items, truncated };
}

/**
 * PM-17 · CL-17 · FW-02 — 볼 수 없으면 null.
 * 고객은 공개분만 (POL-004 이중 검증, RLS 와 같은 조건). 보관 여부는 페이지가 판단한다(편집자는 보관본도 본다).
 */
export async function getPhoto(
  projectId: string,
  photoId: string,
  viewer: ProjectAccess,
): Promise<PhotoItem | null> {
  const supabase = await createServerSupabase();
  let query = supabase.from('photos').select(COLUMNS).eq('id', photoId).eq('project_id', projectId);
  if (viewer.as === 'customer') query = query.eq('is_public', true);
  const { data } = await query.maybeSingle();
  if (!data) return null;
  const row = data as PhotoRow;
  if (viewer.as === 'customer' && !row.is_public) return null;
  const names = await profileNames(supabase, [row.uploaded_by]);
  return toItem(row, names);
}

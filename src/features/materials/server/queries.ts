// 자재 조회 — 고객 필터는 RLS(row_visible_materials). snake_case → camelCase 변환은 여기서만
import 'server-only';
import { notFound } from 'next/navigation';
import { PAGE_SIZE } from '@/shared/contracts/domain';
import type { ProjectAccess } from '@/shared/contracts/integration';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { listConfirmations } from '@/features/designs/server/confirmations';
import { materialSearchFilter, type MaterialFilter } from '@/features/materials/schema';
import type { MaterialDetail, MaterialListItem } from '@/features/materials/types';

const LIST_COLUMNS =
  'id, name, category, space, spec, quantity, unit, unit_price, image_file_id, is_public, confirm_state, archived_at';

type ListRow = {
  id: string;
  name: string;
  category: string;
  space: MaterialListItem['space'];
  spec: string;
  quantity: number | null;
  unit: string;
  unit_price: number | null;
  image_file_id: string | null;
  is_public: boolean;
  confirm_state: MaterialListItem['confirmState'];
  archived_at: string | null;
};

const num = (v: number | string | null) => (v === null ? null : Number(v));

function toListItem(r: ListRow): MaterialListItem {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    space: r.space,
    spec: r.spec,
    quantity: num(r.quantity),
    unit: r.unit,
    unitPrice: num(r.unit_price),
    imageFileId: r.image_file_id,
    isPublic: r.is_public,
    confirmState: r.confirm_state,
    archivedAt: r.archived_at,
  };
}

export async function listMaterials(
  projectId: string,
  viewer: ProjectAccess,
  filter: MaterialFilter,
  opts: { archived?: boolean; limit?: number } = {},
): Promise<{ items: MaterialListItem[]; hasMore: boolean; total: number }> {
  const supabase = await createServerSupabase();
  const limit = opts.limit ?? PAGE_SIZE;
  let q = supabase
    .from('materials')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);
  q =
    viewer.as === 'editor' && opts.archived
      ? q.not('archived_at', 'is', null)
      : q.is('archived_at', null);
  // REQ-110: 카테고리·공간·검색어는 서로 독립적으로 결합(AND)
  if (filter.category) q = q.eq('category', filter.category);
  if (filter.space) q = q.eq('space', filter.space);
  // B-11: 큰따옴표 값 문법 — "2.5T"·"600*600" 이 그대로 검색되고 `a,b)` 가 구문을 깨지 않는다
  const search = materialSearchFilter(filter.q);
  if (search) q = q.or(search);
  const { data, error, count } = await q;
  if (error) throw new Error(`materials.list:${error.code}`);
  const rows = (data ?? []) as ListRow[];
  return {
    items: rows.slice(0, limit).map(toListItem),
    hasMore: rows.length > limit,
    total: count ?? rows.length,
  };
}

/** 필터 선택지: 볼 수 있는 자재의 카테고리 (중복 제거, 가나다순) */
export async function listMaterialCategories(projectId: string): Promise<string[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('materials')
    .select('category')
    .eq('project_id', projectId)
    .is('archived_at', null)
    .neq('category', '')
    .limit(1000);
  if (error) throw new Error(`materials.categories:${error.code}`);
  return [...new Set((data ?? []).map((r) => r.category))].sort((a, b) => a.localeCompare(b, 'ko'));
}

export async function getMaterial(projectId: string, materialId: string): Promise<MaterialDetail> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('materials')
    .select(`${LIST_COLUMNS}, location_note, description, revision, version, updated_at`)
    .eq('id', materialId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (error && error.code !== '22P02') throw new Error(`materials.detail:${error.code}`);
  if (!data) notFound();
  const row = data as ListRow & {
    location_note: string;
    description: string;
    revision: number;
    version: number;
    updated_at: string;
  };
  return {
    ...toListItem(row),
    locationNote: row.location_note,
    description: row.description,
    revision: row.revision,
    version: row.version,
    updatedAt: row.updated_at,
    confirmations: await listConfirmations('materials', row.id),
  };
}

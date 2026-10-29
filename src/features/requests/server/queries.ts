// requests 조회 — Server Component 에서 호출. snake_case → camelCase 변환은 여기서만 (헌법 7.1)
// 권한은 RLS(row_visible_requests)가 판정한다: 고객은 본인이 쓴 요청만 (POL-018)
import 'server-only';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import type { ProjectAccess } from '@/shared/contracts/integration';
import { buildRequestThread } from '../lib/thread';
import { escapeLike } from '../lib/list-params';
import type { RequestTargetType } from '../schema';
import type {
  RequestDetail,
  RequestListFilters,
  RequestListItem,
  RequestTarget,
  RequestThreadEntry,
} from '../types';

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

async function profileNames(supabase: Supabase, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  // 볼 수 없는 프로필(can_see_profile)은 빠진다 → 화면에서 대체 문구
  const { data } = await supabase.from('profiles').select('id, display_name').in('id', unique);
  return new Map((data ?? []).map((p) => [p.id, p.display_name]));
}

const latest = (values: string[]) => values.reduce((a, b) => (b > a ? b : a));

interface TargetRow {
  target_type: string | null;
  target_id: string | null;
}

/** D-32: 연결 항목 이름 — 도안 제목 · 자재 이름 (호출자 RLS 로 볼 수 있는 것만, 없으면 label null) */
export async function targetsOf(
  supabase: Supabase,
  rows: TargetRow[],
): Promise<(RequestTarget | null)[]> {
  const ids = (type: RequestTargetType) => [
    ...new Set(rows.filter((r) => r.target_type === type && r.target_id).map((r) => r.target_id!)),
  ];
  const designIds = ids('designs');
  const materialIds = ids('materials');
  const [designs, materials] = await Promise.all([
    designIds.length
      ? supabase.from('designs').select('id, title').in('id', designIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    materialIds.length
      ? supabase.from('materials').select('id, name').in('id', materialIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const label = new Map<string, string>([
    ...(designs.data ?? []).map((d) => [d.id, d.title] as [string, string]),
    ...(materials.data ?? []).map((m) => [m.id, m.name] as [string, string]),
  ]);
  return rows.map((r) =>
    r.target_type && r.target_id
      ? {
          type: r.target_type as RequestTargetType,
          id: r.target_id,
          label: label.get(r.target_id) ?? null,
        }
      : null,
  );
}

export async function listRequests(
  projectId: string,
  viewer: ProjectAccess,
  f: RequestListFilters,
  userId: string,
): Promise<{ items: RequestListItem[]; hasMore: boolean }> {
  const supabase = await createServerSupabase();
  let query = supabase
    .from('requests')
    .select(
      'id, title, status, author_id, created_at, updated_at, archived_at, target_type, target_id, request_replies(created_at), request_corrections(created_at)',
    )
    .eq('project_id', projectId);
  // POL-018 이중 검증: RLS 와 같은 조건을 쿼리에도 둔다
  if (viewer.as !== 'editor') query = query.eq('author_id', userId);
  query = f.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
  if (f.status) query = query.eq('status', f.status);
  if (f.q) query = query.ilike('title', `%${escapeLike(f.q)}%`);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(f.size + 1);
  if (error) throw new Error(`requests.list:${error.code ?? 'unknown'}`);

  const rows = data ?? [];
  const page = rows.slice(0, f.size);
  const [names, targets] = await Promise.all([
    profileNames(
      supabase,
      page.map((r) => r.author_id),
    ),
    targetsOf(supabase, page),
  ]);
  const items = page.map<RequestListItem>((r, i) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    authorId: r.author_id,
    authorName: names.get(r.author_id) ?? null,
    createdAt: r.created_at,
    lastActivityAt: latest([
      r.created_at,
      r.updated_at,
      ...r.request_replies.map((x) => x.created_at),
      ...r.request_corrections.map((x) => x.created_at),
    ]),
    hasReply: r.request_replies.length > 0,
    archived: r.archived_at !== null,
    target: targets[i] ?? null,
  }));
  return { items, hasMore: rows.length > f.size };
}

/**
 * PM-16 / CL-16 — 볼 수 없으면 null (페이지가 notFound).
 * POL-018 이중 검증 (C-01): 편집자가 아니면 본인이 쓴 요청만 — 목록(listRequests)·RLS 와 같은 조건.
 */
export async function getRequestDetail(
  projectId: string,
  requestId: string,
  viewer: ProjectAccess,
  userId: string,
): Promise<RequestDetail | null> {
  const supabase = await createServerSupabase();
  let query = supabase
    .from('requests')
    .select(
      'id, project_id, title, body, status, version, author_id, created_at, archived_at, target_type, target_id',
    )
    .eq('id', requestId)
    .eq('project_id', projectId);
  if (viewer.as !== 'editor') query = query.eq('author_id', userId);
  const { data: r } = await query.maybeSingle();
  if (!r) return null;
  if (viewer.as !== 'editor' && r.author_id !== userId) return null;
  const [corrections, replies] = await Promise.all([
    supabase
      .from('request_corrections')
      .select('id, body, author_id, created_at')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true }),
    supabase
      .from('request_replies')
      .select('id, body, author_id, created_at')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true }),
  ]);
  const map = (x: { id: string; body: string; author_id: string; created_at: string }) => ({
    id: x.id,
    body: x.body,
    authorId: x.author_id,
    createdAt: x.created_at,
  });
  const cs = (corrections.data ?? []).map(map);
  const rs = (replies.data ?? []).map(map);
  const [names, [target]] = await Promise.all([
    profileNames(supabase, [
      r.author_id,
      ...cs.map((c) => c.authorId),
      ...rs.map((c) => c.authorId),
    ]),
    targetsOf(supabase, [r]),
  ]);
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    status: r.status,
    version: r.version,
    authorId: r.author_id,
    authorName: names.get(r.author_id) ?? null,
    createdAt: r.created_at,
    archivedAt: r.archived_at,
    target: target ?? null,
    entries: buildRequestThread(
      { id: r.id, body: r.body, authorId: r.author_id, createdAt: r.created_at },
      cs,
      rs,
      names,
    ),
  };
}

/**
 * CU-04: 목록 카드에 보일 항목별 메모 수 — listItemMemos 와 같은 조건(보관 제외 · 고객은 본인 메모만).
 * 결과: { [targetId]: 개수 } (메모가 없는 항목은 키가 없다)
 */
export async function countItemMemos(
  projectId: string,
  viewer: ProjectAccess,
  userId: string,
  targetType: RequestTargetType,
): Promise<Record<string, number>> {
  if (viewer.as === 'field') return {};
  const supabase = await createServerSupabase();
  let query = supabase
    .from('requests')
    .select('target_id')
    .eq('project_id', projectId)
    .eq('target_type', targetType)
    .is('archived_at', null);
  if (viewer.as !== 'editor') query = query.eq('author_id', userId);
  const { data, error } = await query.limit(1000);
  if (error) throw new Error(`requests.item_memo_counts:${error.code ?? 'unknown'}`);
  const counts: Record<string, number> = {};
  for (const r of data ?? []) {
    if (r.target_id) counts[r.target_id] = (counts[r.target_id] ?? 0) + 1;
  }
  return counts;
}

export interface ItemMemo {
  id: string;
  status: RequestDetail['status'];
  authorId: string;
  createdAt: string;
  entries: RequestThreadEntry[];
}

/**
 * D-32 · CU-05: 한 항목(도안 · 자재)에 달린 메모와 대화 — 보관되지 않은 것만, 오래된 순.
 * 권한은 RLS: 고객은 본인 메모만, 편집자는 전체 (POL-018 이중 검증으로 쿼리에도 조건)
 */
export async function listItemMemos(
  projectId: string,
  viewer: ProjectAccess,
  userId: string,
  targetType: RequestTargetType,
  targetId: string,
): Promise<ItemMemo[]> {
  if (viewer.as === 'field') return [];
  const supabase = await createServerSupabase();
  let query = supabase
    .from('requests')
    .select('id, body, status, author_id, created_at')
    .eq('project_id', projectId)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .is('archived_at', null);
  if (viewer.as !== 'editor') query = query.eq('author_id', userId);
  const { data, error } = await query
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(50);
  if (error) throw new Error(`requests.item_memos:${error.code ?? 'unknown'}`);
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [corrections, replies] = await Promise.all([
    supabase
      .from('request_corrections')
      .select('id, request_id, body, author_id, created_at')
      .in('request_id', ids)
      .order('created_at', { ascending: true }),
    supabase
      .from('request_replies')
      .select('id, request_id, body, author_id, created_at')
      .in('request_id', ids)
      .order('created_at', { ascending: true }),
  ]);
  type Entry = {
    id: string;
    request_id: string;
    body: string;
    author_id: string;
    created_at: string;
  };
  const raw = (x: Entry) => ({
    id: x.id,
    body: x.body,
    authorId: x.author_id,
    createdAt: x.created_at,
  });
  const cs = (corrections.data ?? []) as Entry[];
  const rs = (replies.data ?? []) as Entry[];
  const names = await profileNames(supabase, [
    ...rows.map((r) => r.author_id),
    ...cs.map((c) => c.author_id),
    ...rs.map((c) => c.author_id),
  ]);
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    authorId: r.author_id,
    createdAt: r.created_at,
    entries: buildRequestThread(
      { id: r.id, body: r.body, authorId: r.author_id, createdAt: r.created_at },
      cs.filter((c) => c.request_id === r.id).map(raw),
      rs.filter((c) => c.request_id === r.id).map(raw),
      names,
    ),
  }));
}

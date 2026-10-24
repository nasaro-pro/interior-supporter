// requests 조회 — Server Component 에서 호출. snake_case → camelCase 변환은 여기서만 (헌법 7.1)
// 권한은 RLS(row_visible_requests)가 판정한다: 고객은 본인이 쓴 요청만 (POL-018)
import 'server-only';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import type { ProjectAccess } from '@/shared/contracts/integration';
import { buildRequestThread } from '../lib/thread';
import { escapeLike } from '../lib/list-params';
import type { RequestDetail, RequestListFilters, RequestListItem } from '../types';

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

async function profileNames(supabase: Supabase, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  // 볼 수 없는 프로필(can_see_profile)은 빠진다 → 화면에서 대체 문구
  const { data } = await supabase.from('profiles').select('id, display_name').in('id', unique);
  return new Map((data ?? []).map((p) => [p.id, p.display_name]));
}

const latest = (values: string[]) => values.reduce((a, b) => (b > a ? b : a));

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
      'id, title, status, author_id, created_at, updated_at, archived_at, request_replies(created_at), request_corrections(created_at)',
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
  const names = await profileNames(
    supabase,
    page.map((r) => r.author_id),
  );
  const items = page.map<RequestListItem>((r) => ({
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
    .select('id, project_id, title, body, status, version, author_id, created_at, archived_at')
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
  const names = await profileNames(supabase, [
    r.author_id,
    ...cs.map((c) => c.authorId),
    ...rs.map((c) => c.authorId),
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
    entries: buildRequestThread(
      { id: r.id, body: r.body, authorId: r.author_id, createdAt: r.created_at },
      cs,
      rs,
      names,
    ),
  };
}

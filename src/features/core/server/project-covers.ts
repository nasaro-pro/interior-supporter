// src/features/core/server/project-covers.ts (A) — 프로젝트 카드의 대표 사진 = 그 프로젝트의 가장 최근 현장 사진 (썸네일)
// 원본(photos)을 호출자 권한(RLS)으로 조회한다. 사진이 없거나 실패하면 빈 칸 (카드는 사진 자리만 비운다)
import 'server-only';
import { logger } from '@/shared/lib/logger';
import { createServerSupabase } from '@/shared/lib/supabase/server';

export async function projectCovers(projectIds: string[]): Promise<Map<string, string>> {
  const covers = new Map<string, string>();
  if (projectIds.length === 0) return covers;
  const supabase = await createServerSupabase();
  // 프로젝트마다 1장씩 (한 프로젝트에 사진이 많아도 다른 프로젝트 사진이 밀려나지 않게)
  const rows = await Promise.all(
    projectIds.map(async (id) => {
      const { data, error } = await supabase
        .from('photos')
        .select('file_id, thumb_file_id')
        .eq('project_id', id)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) logger.warn('projects.covers.failed', { projectId: id, dbCode: error.code });
      return [id, data ? (data.thumb_file_id ?? data.file_id) : null] as const;
    }),
  );
  for (const [id, file] of rows) if (file) covers.set(id, file);
  return covers;
}

// 확정 기록 조회 (REQ-112 "누가·언제·어느 리비전") — 도안·자재 공용, 호출자 RLS 그대로
import 'server-only';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import type { ConfirmTargetType } from '@/features/designs/schema';
import type { ConfirmationRecord } from '@/features/designs/types';

export async function listConfirmations(
  targetType: ConfirmTargetType,
  targetId: string,
): Promise<ConfirmationRecord[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('confirmations')
    .select('id, target_revision, confirmed_at, confirmed_by, invalidated_at, invalidated_reason')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('confirmed_at', { ascending: false });
  if (error) throw new Error(`confirmations.select:${error.code}`);
  const userIds = [...new Set((data ?? []).map((c) => c.confirmed_by))];
  const names = new Map<string, string>();
  if (userIds.length) {
    // 이름을 볼 수 없는 프로필(can_see_profile 거부)은 이름 없이 표시한다
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', userIds);
    if (profileError) throw new Error(`confirmations.profiles:${profileError.code}`);
    for (const p of profiles ?? []) names.set(p.id, p.display_name);
  }
  return (data ?? []).map((c) => ({
    id: c.id,
    targetRevision: c.target_revision,
    confirmedAt: c.confirmed_at,
    confirmedByName: names.get(c.confirmed_by) ?? null,
    invalidatedAt: c.invalidated_at,
    invalidatedReason: c.invalidated_reason,
  }));
}

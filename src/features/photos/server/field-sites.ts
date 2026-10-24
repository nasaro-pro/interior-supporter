// 시공팀 유효 배정 현장 (POL-005·POL-006) — AccessContext 의 유효 field 참여 ∩ DB RPC field_projects()
// DB-05(20261013000110): 시공팀은 projects 테이블을 직접 읽을 수 없다 → SECURITY DEFINER RPC 로 이름·현장 주소만 받는다.
// RPC 는 is_field_on + 보관 제외를 DB 가 판정하고, 앱은 AccessContext 참여로 한 번 더 거른다 (P-02 이중 검증).
import 'server-only';
import type { AccessContext } from '@/shared/contracts/integration';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import type { FieldSite } from '../lib/site';

export async function listFieldSites(ctx: AccessContext): Promise<FieldSite[]> {
  const ids = new Set(ctx.participations.filter((p) => p.role === 'field').map((p) => p.projectId));
  if (ids.size === 0) return [];
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('field_projects');
  // 조용히 [] 로 돌리면 "배정 현장 없음" 으로 오인되므로 오류 경계(error.tsx)로 보낸다
  if (error) throw new Error(`photos.fieldSites:${error.code ?? 'unknown'}`);
  return (data ?? [])
    .filter((p) => ids.has(p.id))
    .map((p) => ({ projectId: p.id, name: p.name, siteAddress: p.site_address }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

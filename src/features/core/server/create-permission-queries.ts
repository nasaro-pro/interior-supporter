// src/features/core/server/create-permission-queries.ts (A · D-36 · CA-07) — 프로젝트 생성 권한 · 요청 조회
import 'server-only';
import type { MemberRole } from '@/shared/contracts/domain';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { displayNames } from './participant-queries';

export interface CreatePermissionState {
  /** 지금 프로젝트를 만들 수 있는가 (업체관리자는 항상) */
  allowed: boolean;
  /** 대기 중인 요청이 있는가 */
  pending: boolean;
}

/** 로그인한 사람의 이 업체 생성 권한 (RLS: 본인 소속 행 · 본인 요청만 보임) */
export async function getCreatePermission(
  companyId: string,
  role: MemberRole,
  userId: string,
): Promise<CreatePermissionState> {
  if (role === 'owner' || role === 'manager') return { allowed: true, pending: false };
  const supabase = await createServerSupabase();
  const [member, request] = await Promise.all([
    supabase
      .from('company_members')
      .select('can_create_projects')
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .is('removed_at', null)
      .maybeSingle(),
    supabase
      .from('project_create_requests')
      .select('id')
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle(),
  ]);
  // 조회 실패는 '권한 없음'으로 — 서버 액션 · RLS 가 다시 막는다
  return {
    allowed: Boolean(member.data?.can_create_projects),
    pending: Boolean(request.data),
  };
}

export interface CreatePermissionRequestItem {
  id: string;
  userId: string;
  displayName: string;
  note: string;
  createdAt: string;
}

/** 업체관리자: 대기 중 요청 목록 (RLS 가 업체관리자에게만 업체 전체를 보여 준다) */
export async function listCreatePermissionRequests(
  companyId: string,
): Promise<CreatePermissionRequestItem[] | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('project_create_requests')
    .select('id, user_id, note, created_at')
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) return null;
  const names = await displayNames(data.map((r) => r.user_id));
  return data.map((r) => ({
    id: r.id,
    userId: r.user_id,
    displayName: names.get(r.user_id) ?? '—',
    note: r.note,
    createdAt: r.created_at,
  }));
}

// src/features/admin/server/guard.ts — 사이트 관리자 접근 검사 (A1). 화면은 존재를 숨기고(404), 액션은 FORBIDDEN
// 1차 검사일 뿐이고, 실제 보호는 모든 관리자 RPC 안의 private.require_platform_admin() 이 한다 (P-02 이중 검증)
import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getSessionUserId } from '@/features/core/server/access';
import { routes } from '@/shared/contracts/routes';
import { createServerSupabase } from '@/shared/lib/supabase/server';

/** 로그인한 사용자가 사이트 관리자인가 (요청 1번에 1회 조회) */
export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  const userId = await getSessionUserId();
  if (!userId) return false;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('is_platform_admin');
  return !error && data === true;
});

/** /admin 화면용: 비로그인 → 관리자 로그인, 관리자가 아니면 404 */
export async function requirePlatformAdmin(): Promise<void> {
  const userId = await getSessionUserId();
  if (!userId) redirect(routes.admin.login());
  if (!(await isPlatformAdmin())) notFound();
}

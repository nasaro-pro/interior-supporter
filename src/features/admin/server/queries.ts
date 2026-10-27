// src/features/admin/server/queries.ts — 사이트 관리 화면 조회 (A3~A8). 모두 관리자 RPC 를 RLS 사용자 권한으로 부른다
// RPC 오류는 화면 오류 경계(error.tsx)로 보낸다 — 조용히 빈 목록으로 바꾸면 "자료 없음"으로 오인된다
import 'server-only';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import {
  toAuditRow,
  toCleanupCandidate,
  toCompanyRow,
  toDashboard,
  toMemberRow,
  toSiteSettings,
  toUserRow,
} from '../lib/mappers';
import type {
  AdminAuditRow,
  AdminCompanyRow,
  AdminDashboard,
  AdminMemberRow,
  AdminUserRow,
  CleanupCandidate,
  SiteSettings,
} from '../types';

/** 목록 한 번에 보여 주는 수 */
export const ADMIN_PAGE_SIZE = 50;

const raise = (what: string, code?: string): never => {
  throw new Error(`admin.${what}:${code ?? 'unknown'}`);
};

export async function getDashboard(): Promise<AdminDashboard> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('admin_dashboard');
  if (error) raise('dashboard', error.code);
  return toDashboard(data?.[0]);
}

export async function listCompanies(q?: string, offset = 0): Promise<AdminCompanyRow[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('admin_companies', {
    p_search: q ?? '',
    p_limit: ADMIN_PAGE_SIZE,
    p_offset: offset,
  });
  if (error) raise('companies', error.code);
  return (data ?? []).map(toCompanyRow);
}

/** 업체 1곳 (목록 RPC 를 id 로 좁혀 쓴다 — 별도 RPC 를 늘리지 않는다) */
export async function getCompany(companyId: string): Promise<AdminCompanyRow | null> {
  const rows = await listCompanies();
  const hit = rows.find((r) => r.id === companyId);
  if (hit) return hit;
  // 첫 쪽에 없으면 끝까지 찾는다 (업체 수가 적은 운영 초기 기준)
  for (let offset = ADMIN_PAGE_SIZE; ; offset += ADMIN_PAGE_SIZE) {
    const page = await listCompanies(undefined, offset);
    const found = page.find((r) => r.id === companyId);
    if (found || page.length < ADMIN_PAGE_SIZE) return found ?? null;
  }
}

export async function listCompanyMembers(companyId: string): Promise<AdminMemberRow[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('admin_company_members', { p_company: companyId });
  if (error) raise('members', error.code);
  return (data ?? []).map(toMemberRow);
}

export async function listUsers(q?: string, offset = 0): Promise<AdminUserRow[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('admin_users', {
    p_search: q ?? '',
    p_limit: ADMIN_PAGE_SIZE,
    p_offset: offset,
  });
  if (error) raise('users', error.code);
  return (data ?? []).map(toUserRow);
}

/** 업로드 한도·기본 저장공간 (로그인 사용자 누구나 읽는다 — 업로드 화면도 쓴다) */
export async function getSiteSettings(): Promise<SiteSettings | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from('site_settings').select('*').maybeSingle();
  if (error) raise('settings', error.code);
  return toSiteSettings(data);
}

export async function listCleanupCandidates(): Promise<CleanupCandidate[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('admin_cleanup_candidates');
  if (error) raise('cleanup', error.code);
  return (data ?? []).map(toCleanupCandidate);
}

export async function listAudit(offset = 0): Promise<AdminAuditRow[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('admin_audit', {
    p_limit: ADMIN_PAGE_SIZE,
    p_offset: offset,
  });
  if (error) raise('audit', error.code);
  return (data ?? []).map(toAuditRow);
}

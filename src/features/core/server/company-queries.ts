// src/features/core/server/company-queries.ts (A · TASK-015·016) — 업체 정보·템플릿·저장공간 (PM-61·63·64)
import 'server-only';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import type { FileKind } from '@/shared/contracts/domain';
import { logger } from '@/shared/lib/logger';

export async function getCompanySettings(companyId: string) {
  const supabase = await createServerSupabase();
  const [{ data: company }, { data: settings }] = await Promise.all([
    supabase
      .from('companies')
      .select('id, slug, name, logo_file_id, version')
      .eq('id', companyId)
      .maybeSingle(),
    supabase
      .from('company_settings')
      .select('default_home_message, version')
      .eq('company_id', companyId)
      .maybeSingle(),
  ]);
  if (!company) return null;
  return {
    id: company.id,
    slug: company.slug,
    name: company.name,
    logoFileId: company.logo_file_id,
    version: company.version,
    defaultHomeMessage: settings?.default_home_message ?? '',
    settingsVersion: settings?.version ?? 1,
  };
}

export const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024; // Supabase 무료 1GB (NFR-012)

/** PM-64: 전체 사용량(RPC, manager 전용) + 종류별 합계 */
export async function getStorageUsage(
  companyId: string,
): Promise<{ used: number; byKind: Partial<Record<FileKind, number>> } | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('company_storage_usage', { p_company: companyId });
  if (error) {
    logger.warn('storage.usage.failed', { companyId, dbCode: error.code });
    return null;
  }
  const { data: files } = await supabase
    .from('files')
    .select('kind, size_bytes')
    .eq('company_id', companyId)
    .eq('status', 'ready');
  const byKind: Partial<Record<FileKind, number>> = {};
  for (const f of files ?? []) byKind[f.kind] = (byKind[f.kind] ?? 0) + f.size_bytes;
  return { used: Number(data ?? 0), byKind };
}

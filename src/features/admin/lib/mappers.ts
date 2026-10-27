// src/features/admin/lib/mappers.ts — RPC 결과 행(snake_case) → 화면 타입. DB 를 부르지 않는 순수 함수
import type {
  AdminAuditRow,
  AdminCompanyRow,
  AdminDashboard,
  AdminMemberRow,
  AdminUserRow,
  CleanupCandidate,
  SiteSettings,
} from '../types';

type Row = Record<string, unknown>;
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0));
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const strOrNull = (v: unknown) => (typeof v === 'string' ? v : null);

export function toDashboard(r: Row | undefined): AdminDashboard {
  return {
    companies: num(r?.companies),
    users: num(r?.users),
    projects: num(r?.projects),
    storageBytes: num(r?.storage_bytes),
    signups7d: num(r?.signups_7d),
    suspendedUsers: num(r?.suspended_users),
  };
}

export function toCompanyRow(r: Row): AdminCompanyRow {
  return {
    id: str(r.id),
    slug: str(r.slug),
    name: str(r.name),
    createdAt: str(r.created_at),
    ownerId: strOrNull(r.owner_id),
    ownerName: strOrNull(r.owner_name),
    memberCount: num(r.member_count),
    projectCount: num(r.project_count),
    storageBytes: num(r.storage_bytes),
    quotaBytes: numOrNull(r.quota_bytes),
  };
}

export function toMemberRow(r: Row): AdminMemberRow {
  return {
    userId: str(r.user_id),
    displayName: str(r.display_name),
    role: (str(r.role) || 'pm') as AdminMemberRow['role'],
  };
}

export function toUserRow(r: Row): AdminUserRow {
  const memberships = Array.isArray(r.memberships) ? (r.memberships as Row[]) : [];
  return {
    id: str(r.id),
    email: str(r.email),
    displayName: str(r.display_name),
    createdAt: str(r.created_at),
    lastSignInAt: strOrNull(r.last_sign_in_at),
    suspendedAt: strOrNull(r.suspended_at),
    anonymizedAt: strOrNull(r.anonymized_at),
    memberships: memberships.map((m) => ({
      company: str(m.company),
      slug: str(m.slug),
      role: str(m.role),
    })),
    participationCount: num(r.participation_count),
    isAdmin: r.is_admin === true,
  };
}

export function toSiteSettings(r: Row | null | undefined): SiteSettings | null {
  if (!r) return null;
  return {
    photoMaxBytes: num(r.photo_max_bytes),
    photoBatchMax: num(r.photo_batch_max),
    designMaxBytes: num(r.design_max_bytes),
    defaultQuotaBytes: numOrNull(r.default_quota_bytes),
    updatedAt: str(r.updated_at),
  };
}

export function toCleanupCandidate(r: Row): CleanupCandidate {
  return {
    id: str(r.id),
    companyName: str(r.company_name),
    kind: str(r.kind),
    status: (str(r.status) || 'pending') as CleanupCandidate['status'],
    originalName: str(r.original_name),
    sizeBytes: num(r.size_bytes),
    bucket: str(r.bucket),
    path: str(r.path),
    createdAt: str(r.created_at),
  };
}

export function toAuditRow(r: Row): AdminAuditRow {
  return {
    id: num(r.id),
    actorName: strOrNull(r.actor_name),
    action: str(r.action),
    targetType: str(r.target_type),
    targetId: strOrNull(r.target_id),
    detail: r.detail && typeof r.detail === 'object' ? (r.detail as Record<string, unknown>) : {},
    occurredAt: str(r.occurred_at),
  };
}

/** 정리 대상 파일을 저장소 버킷별로 묶는다 (Storage remove 는 버킷 단위 호출) */
export function groupPathsByBucket(
  files: Pick<CleanupCandidate, 'bucket' | 'path'>[],
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const f of files) out.set(f.bucket, [...(out.get(f.bucket) ?? []), f.path]);
  return out;
}

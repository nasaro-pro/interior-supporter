// src/features/admin/types.ts — 사이트 관리 화면 데이터 (RPC 결과를 화면용 이름으로)

export interface AdminDashboard {
  companies: number;
  users: number;
  projects: number;
  storageBytes: number;
  signups7d: number;
  suspendedUsers: number;
}

export interface AdminCompanyRow {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
  ownerId: string | null;
  ownerName: string | null;
  memberCount: number;
  projectCount: number;
  storageBytes: number;
  quotaBytes: number | null;
}

export interface AdminMemberRow {
  userId: string;
  displayName: string;
  role: 'owner' | 'manager' | 'pm';
}

export interface AdminUserRow {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  lastSignInAt: string | null;
  suspendedAt: string | null;
  anonymizedAt: string | null;
  memberships: { company: string; slug: string; role: string }[];
  participationCount: number;
  isAdmin: boolean;
}

export interface SiteSettings {
  photoMaxBytes: number;
  photoBatchMax: number;
  designMaxBytes: number;
  defaultQuotaBytes: number | null;
  updatedAt: string;
}

export interface CleanupCandidate {
  id: string;
  companyName: string;
  kind: string;
  status: 'pending' | 'ready' | 'rejected';
  originalName: string;
  sizeBytes: number;
  bucket: string;
  path: string;
  createdAt: string;
}

export interface AdminAuditRow {
  id: number;
  actorName: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  detail: Record<string, unknown>;
  occurredAt: string;
}

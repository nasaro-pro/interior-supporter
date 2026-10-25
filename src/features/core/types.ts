// src/features/core/types.ts (A) — 화면용 타입 (camelCase)
import type {
  HomeSections,
  MemberRole,
  ParticipantRole,
  ProjectStatus,
} from '@/shared/contracts/domain';
import type { HomeTheme } from './home-theme';
import type { PageImages, PageTone } from './page-theme';

export interface ProjectListItem {
  id: string;
  name: string;
  siteAddress: string;
  startDate: string | null;
  endDate: string | null;
  status: ProjectStatus;
  currentPhase: string;
  isPublic: boolean;
  archivedAt: string | null;
}

export interface ProjectDetail extends ProjectListItem {
  companyId: string;
  homeMessage: string;
  homeSections: HomeSections;
  homeTheme: HomeTheme;
  pageImages: PageImages;
  pageTone: PageTone;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ParticipantItem {
  id: string;
  userId: string;
  displayName: string;
  role: ParticipantRole;
  canConfirm: boolean;
  validFrom: string | null;
  validUntil: string | null;
  revokedAt: string | null;
  version: number;
  /** 'active' | 'pending'(시작 전) | 'expired'(종료 후) | 'revoked' */
  state: 'active' | 'pending' | 'expired' | 'revoked';
}

export interface InviteItem {
  id: string;
  email: string;
  role: ParticipantRole | MemberRole;
  canConfirm: boolean;
  validFrom: string | null;
  validUntil: string | null;
  expiresAt: string;
}

export interface MemberItem {
  id: string;
  userId: string;
  displayName: string;
  role: MemberRole;
  createdAt: string;
  version: number;
}

export interface ClientItem {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  memo: string;
  archivedAt: string | null;
  updatedAt: string;
  version: number;
}

export interface AuditItem {
  id: number;
  occurredAt: string;
  eventType: string;
  objectType: string;
  objectId: string;
  projectId: string | null;
  projectName: string | null;
  actorName: string | null;
}

export interface NotificationItem {
  id: string;
  type: string;
  objectType: string;
  createdAt: string;
  readAt: string | null;
  projectName: string | null;
  /** 현재 권한으로 다시 조회한 대상 제목 (못 보면 null) */
  targetTitle: string | null;
}

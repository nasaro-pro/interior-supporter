// requests 화면용 타입 (camelCase)
import type { RequestStatus } from '@/shared/contracts/domain';

export interface RequestListItem {
  id: string;
  title: string;
  status: RequestStatus;
  authorId: string;
  /** 프로필을 볼 수 없으면 null */
  authorName: string | null;
  createdAt: string;
  /** 원문·정정·답변·상태 변경 중 가장 최근 시각 */
  lastActivityAt: string;
  hasReply: boolean;
  archived: boolean;
}

export interface RequestListFilters {
  q: string;
  status: RequestStatus | null;
  archived: boolean;
  size: number;
}

export type RequestThreadKind = 'original' | 'correction' | 'reply';

export interface RequestThreadEntry {
  kind: RequestThreadKind;
  id: string;
  body: string;
  authorId: string;
  authorName: string | null;
  createdAt: string;
}

export interface RequestDetail {
  id: string;
  projectId: string;
  title: string;
  status: RequestStatus;
  version: number;
  authorId: string;
  authorName: string | null;
  createdAt: string;
  archivedAt: string | null;
  entries: RequestThreadEntry[];
}

// photos 화면용 타입 (camelCase)
import type { PhotoPhase } from '@/shared/contracts/domain';

export interface PhotoItem {
  id: string;
  projectId: string;
  fileId: string;
  thumbFileId: string | null;
  phase: PhotoPhase;
  /** 'YYYY-MM-DD' 달력 값 */
  capturedOn: string | null;
  description: string;
  isPublic: boolean;
  uploaderId: string;
  uploaderRole: 'staff' | 'field';
  uploaderName: string | null;
  createdAt: string;
  archived: boolean;
  version: number;
}

export interface PhotoListFilters {
  phase: PhotoPhase | null;
  from: string | null;
  to: string | null;
  uploader: string | null;
  archived: boolean;
  size: number;
}

export type PhotoArea = 'app' | 'portal' | 'field';

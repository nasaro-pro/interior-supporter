// 화면용 타입 (camelCase). snake_case 변환은 server/queries.ts 에서만
import type { ConfirmState } from '@/shared/contracts/domain';

export interface DesignListItem {
  id: string;
  title: string;
  currentVersion: number;
  isPublic: boolean;
  confirmState: ConfirmState;
  updatedAt: string;
  archivedAt: string | null;
  previewFileId: string | null;
}

export interface DesignFileInfo {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
}

export interface DesignVersionItem {
  id: string;
  versionNo: number;
  note: string;
  createdAt: string;
  file: DesignFileInfo | null;
}

export interface DesignPreviewItem {
  id: string;
  fileId: string;
  label: string;
  pdfPage: number | null;
  designVersionId: string | null;
  versionNo: number | null;
  width: number | null;
  height: number | null;
}

export interface ConfirmationRecord {
  id: string;
  targetRevision: number;
  confirmedAt: string;
  confirmedByName: string | null;
  invalidatedAt: string | null;
  invalidatedReason: string | null;
}

export interface DesignDetail {
  id: string;
  title: string;
  description: string;
  isPublic: boolean;
  confirmState: ConfirmState;
  currentVersion: number;
  version: number;
  updatedAt: string;
  archivedAt: string | null;
  versions: DesignVersionItem[];
  previews: DesignPreviewItem[];
  confirmations: ConfirmationRecord[];
}

// 화면용 타입 (camelCase)
import type { ConfirmState, MaterialSpace } from '@/shared/contracts/domain';
import type { ConfirmationRecord } from '@/features/designs/types';

export interface MaterialListItem {
  id: string;
  name: string;
  category: string;
  space: MaterialSpace;
  spec: string;
  quantity: number | null;
  unit: string;
  unitPrice: number | null;
  imageFileId: string | null;
  isPublic: boolean;
  confirmState: ConfirmState;
  archivedAt: string | null;
}

export interface MaterialDetail extends MaterialListItem {
  locationNote: string;
  description: string;
  revision: number;
  version: number;
  updatedAt: string;
  confirmations: ConfirmationRecord[];
}

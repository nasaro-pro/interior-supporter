// 시공팀 열람 도메인 타입 (통합본 7장 F1·F2·F9) — 화면이 쓰는 모양. DB 행 → 이 모양 변환은 lib/mappers.ts
import type { PageTone } from '@/features/core/page-theme';
import type { MaterialSpace } from '@/shared/contracts/domain';
import type { FieldTab } from '@/shared/contracts/screens';

/** FW-00 현장 카드 */
export interface FieldSiteCard {
  projectId: string;
  companyName: string;
  name: string;
  siteAddress: string | null;
  validFrom: string | null;
  validUntil: string | null;
  /** 오늘 일정 제목 — 일정 탭이 꺼진 현장은 빈 배열 */
  todayEvents: string[];
}

/** 현장 1곳 머리글 + 켜진 탭 */
export interface FieldSiteDetail {
  projectId: string;
  companyId: string;
  name: string;
  siteAddress: string | null;
  pageTone: PageTone;
  tabs: FieldTab[];
}

export interface FieldScheduleItem {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
}

export interface FieldDesignPreview {
  fileId: string;
  label: string | null;
}

export interface FieldDesign {
  id: string;
  title: string;
  description: string | null;
  confirmedVersion: number;
  originalFileId: string | null;
  previews: FieldDesignPreview[];
}

/** 확정 자재 — 단가 없음 (F2) */
export interface FieldMaterial {
  id: string;
  name: string;
  category: string | null;
  space: MaterialSpace;
  spec: string | null;
  quantity: number | null;
  unit: string | null;
  locationNote: string | null;
  imageFileId: string | null;
}

/** 담당자가 프로젝트마다 정하는 시공팀 공개 범위 (기본 모두 꺼짐) */
export interface FieldAccessSettings {
  showSchedule: boolean;
  showDesigns: boolean;
  showMaterials: boolean;
  photoAutoPublic: boolean;
}

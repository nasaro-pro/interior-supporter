// 시공팀 현장 탭 판정 — 순수 함수 (F2: 담당자가 켠 탭만, 순서는 FIELD_TABS)
import { FIELD_TABS, type FieldTab } from '@/shared/contracts/screens';

export interface TabFlags {
  showSchedule: boolean;
  showDesigns: boolean;
  showMaterials: boolean;
}

const FLAG: Record<FieldTab, keyof TabFlags> = {
  schedule: 'showSchedule',
  designs: 'showDesigns',
  materials: 'showMaterials',
};

/** 켜진 탭 목록 (FIELD_TABS 순서) */
export function visibleTabs(flags: TabFlags): FieldTab[] {
  return FIELD_TABS.filter((tab) => flags[FLAG[tab]]);
}

/** 문자열이 시공팀 탭 이름인가 */
export function isFieldTab(value: string | null | undefined): value is FieldTab {
  return (FIELD_TABS as readonly string[]).includes(value ?? '');
}

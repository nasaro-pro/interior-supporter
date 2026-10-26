// DB RPC 행 → 화면 모양 — 순수 함수. 생성 타입이 null 을 표시하지 않으므로 여기서 null 을 정리한다
import { normalizePageTone } from '@/features/core/page-theme';
import type { MaterialSpace } from '@/shared/contracts/domain';
import type {
  FieldAccessSettings,
  FieldDesign,
  FieldMaterial,
  FieldScheduleItem,
  FieldSiteCard,
  FieldSiteDetail,
} from '../types';
import { visibleTabs } from './tabs';

type Nullable<T> = { [K in keyof T]: T[K] | null };

export interface SiteCardRow {
  id: string;
  company_name: string | null;
  name: string;
  site_address: string | null;
  valid_from: string | null;
  valid_until: string | null;
  today_events: string[] | null;
}

export function toSiteCard(r: SiteCardRow): FieldSiteCard {
  return {
    projectId: r.id,
    companyName: r.company_name ?? '',
    name: r.name,
    siteAddress: r.site_address || null,
    validFrom: r.valid_from,
    validUntil: r.valid_until,
    todayEvents: r.today_events ?? [],
  };
}

export interface SiteRow {
  id: string;
  company_id: string;
  name: string;
  site_address: string | null;
  page_tone: string | null;
  show_schedule: boolean | null;
  show_designs: boolean | null;
  show_materials: boolean | null;
}

export function toSiteDetail(r: SiteRow): FieldSiteDetail {
  return {
    projectId: r.id,
    companyId: r.company_id,
    name: r.name,
    siteAddress: r.site_address || null,
    pageTone: normalizePageTone(r.page_tone),
    tabs: visibleTabs({
      showSchedule: r.show_schedule === true,
      showDesigns: r.show_designs === true,
      showMaterials: r.show_materials === true,
    }),
  };
}

export type ScheduleRow = Nullable<{
  id: string;
  title: string;
  description: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
}> & { id: string; title: string; start_date: string };

/** 'HH:MM:SS' → 'HH:MM' (화면은 분 단위) */
const hm = (v: string | null) => (v ? v.slice(0, 5) : null);

export function toScheduleItem(r: ScheduleRow): FieldScheduleItem {
  return {
    id: r.id,
    title: r.title,
    description: r.description || null,
    startDate: r.start_date,
    startTime: hm(r.start_time),
    endDate: r.end_date,
    endTime: hm(r.end_time),
  };
}

export interface DesignRow {
  id: string;
  title: string;
  description: string | null;
  confirmed_version: number;
  original_file_id: string | null;
  preview_file_ids: string[] | null;
  preview_labels: (string | null)[] | null;
}

/** 미리보기 id·라벨 두 배열을 짝지어 하나로 */
export function toDesign(r: DesignRow): FieldDesign {
  const labels = r.preview_labels ?? [];
  return {
    id: r.id,
    title: r.title,
    description: r.description || null,
    confirmedVersion: r.confirmed_version,
    originalFileId: r.original_file_id,
    previews: (r.preview_file_ids ?? []).map((fileId, i) => ({
      fileId,
      label: labels[i] || null,
    })),
  };
}

export type MaterialRow = Nullable<{
  category: string;
  spec: string;
  quantity: number;
  unit: string;
  location_note: string;
  image_file_id: string;
}> & { id: string; name: string; space: MaterialSpace };

export function toMaterial(r: MaterialRow): FieldMaterial {
  return {
    id: r.id,
    name: r.name,
    category: r.category || null,
    space: r.space,
    spec: r.spec || null,
    quantity: r.quantity,
    unit: r.unit || null,
    locationNote: r.location_note || null,
    imageFileId: r.image_file_id,
  };
}

export const DEFAULT_FIELD_ACCESS: FieldAccessSettings = {
  showSchedule: false,
  showDesigns: false,
  showMaterials: false,
  photoAutoPublic: false,
};

export interface FieldSettingsRow {
  show_schedule: boolean;
  show_designs: boolean;
  show_materials: boolean;
  photo_auto_public: boolean;
}

/** 설정 행이 없으면 기본(모두 꺼짐) */
export function toAccessSettings(r: FieldSettingsRow | null): FieldAccessSettings {
  if (!r) return DEFAULT_FIELD_ACCESS;
  return {
    showSchedule: r.show_schedule,
    showDesigns: r.show_designs,
    showMaterials: r.show_materials,
    photoAutoPublic: r.photo_auto_public,
  };
}

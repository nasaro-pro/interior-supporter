import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FIELD_ACCESS,
  toAccessSettings,
  toDesign,
  toMaterial,
  toScheduleItem,
  toSiteCard,
  toSiteDetail,
} from './mappers';

const ID = '7d0f2a3c-1b4e-4c5d-8e9f-0a1b2c3d4e5f';

describe('toSiteCard', () => {
  it('빈 주소·오늘 일정 없음 정리', () => {
    const c = toSiteCard({
      id: ID,
      company_name: '스튜디오',
      name: '현장A',
      site_address: '',
      valid_from: '2026-10-01',
      valid_until: null,
      today_events: null,
    });
    expect(c).toMatchObject({ siteAddress: null, todayEvents: [], validUntil: null });
  });
});

describe('toSiteDetail', () => {
  it('켜진 탭과 알 수 없는 분위기 → 기본', () => {
    const d = toSiteDetail({
      id: ID,
      company_id: ID,
      name: '현장A',
      site_address: '서울',
      page_tone: 'neon',
      show_schedule: false,
      show_designs: true,
      show_materials: null,
      photo_auto_public: null,
    });
    expect(d.tabs).toEqual(['designs']);
    expect(d.photoAutoPublic).toBe(false);
    expect(d.pageTone).toBe('default');
  });
});

describe('toScheduleItem', () => {
  it('시간은 분 단위로 자른다', () => {
    const s = toScheduleItem({
      id: ID,
      title: '목공',
      description: '',
      start_date: '2026-10-26',
      start_time: '09:30:00',
      end_date: null,
      end_time: null,
    });
    expect(s).toMatchObject({ startTime: '09:30', endTime: null, description: null });
  });
});

describe('toDesign', () => {
  it('미리보기 id·라벨을 짝짓는다 (라벨 모자라면 null)', () => {
    const d = toDesign({
      id: ID,
      title: '거실',
      description: null,
      confirmed_version: 2,
      original_file_id: ID,
      preview_file_ids: ['a', 'b'],
      preview_labels: ['정면'],
    });
    expect(d.previews).toEqual([
      { fileId: 'a', label: '정면' },
      { fileId: 'b', label: null },
    ]);
  });
});

describe('toMaterial', () => {
  it('단가 없이 빈 값 정리', () => {
    const m = toMaterial({
      id: ID,
      name: '타일',
      space: 'bathroom',
      category: '',
      spec: '600x600',
      quantity: 12,
      unit: 'box',
      location_note: null,
      image_file_id: null,
    });
    expect(m).not.toHaveProperty('unitPrice');
    expect(m).toMatchObject({ category: null, spec: '600x600', imageFileId: null });
  });
});

describe('toAccessSettings', () => {
  it('행이 없으면 모두 꺼짐', () => {
    expect(toAccessSettings(null)).toEqual(DEFAULT_FIELD_ACCESS);
  });
});

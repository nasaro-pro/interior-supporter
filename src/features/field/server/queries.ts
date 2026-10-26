// 시공팀 열람 조회 — 시공팀은 SECURITY DEFINER RPC(field_*)로만 읽는다 (도안·자재 RLS 는 B 소유라 건드리지 않음)
// RPC 가 유효 배정·켜진 탭을 판정하고(POL-006·F2), 페이지는 requireProjectAccess 로 한 번 더 막는다 (P-02 이중 검증)
// 오류를 [] 로 돌리면 '없음'으로 오인되므로 오류 경계(error.tsx)로 보낸다
import 'server-only';
import { cache } from 'react';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import {
  toAccessSettings,
  toDesign,
  toMaterial,
  toScheduleItem,
  toSiteCard,
  toSiteDetail,
} from '../lib/mappers';
import type {
  FieldAccessSettings,
  FieldDesign,
  FieldMaterial,
  FieldScheduleItem,
  FieldSiteCard,
  FieldSiteDetail,
} from '../types';

function queryFail(name: string, error: { code?: string }): never {
  throw new Error(`field.${name}:${error.code ?? 'unknown'}`);
}

/** FW-00 내 현장 카드 (배정 기간·오늘 일정) */
export async function listFieldSiteCards(): Promise<FieldSiteCard[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('field_sites');
  if (error) queryFail('sites', error);
  return (data ?? []).map(toSiteCard);
}

/** 현장 1곳 + 켜진 탭. 볼 수 없으면 null. 레이아웃과 탭 화면이 같은 요청 안에서 한 번만 읽도록 cache */
export const getFieldSite = cache(async (projectId: string): Promise<FieldSiteDetail | null> => {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('field_site', { p_project: projectId });
  if (error) queryFail('site', error);
  const row = data?.[0];
  return row ? toSiteDetail(row) : null;
});

export async function listFieldSchedule(projectId: string): Promise<FieldScheduleItem[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('field_schedule', { p_project: projectId });
  if (error) queryFail('schedule', error);
  return (data ?? []).map(toScheduleItem);
}

export async function listFieldDesigns(projectId: string): Promise<FieldDesign[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('field_designs', { p_project: projectId });
  if (error) queryFail('designs', error);
  return (data ?? []).map(toDesign);
}

export async function listFieldMaterials(projectId: string): Promise<FieldMaterial[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('field_materials', { p_project: projectId });
  if (error) queryFail('materials', error);
  return (data ?? []).map(toMaterial);
}

/** 담당자 화면(PM-10)용 현재 설정 — RLS 가 편집권자만 행을 보여 준다. 행이 없으면 기본(모두 꺼짐) */
export async function getFieldAccessSettings(projectId: string): Promise<FieldAccessSettings> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('project_field_settings')
    .select('show_schedule, show_designs, show_materials, photo_auto_public')
    .eq('project_id', projectId)
    .maybeSingle();
  if (error) queryFail('settings', error);
  return toAccessSettings(data);
}

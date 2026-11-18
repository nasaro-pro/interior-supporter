'use server';
// 공개 페이지 머리 버튼 문구용 — 페이지 자체는 로그인 정보 없이 그리고, 버튼만 나중에 채운다
import { z } from 'zod';
import { viewerLabelKey, type ViewerLabel } from '../lib/viewer';
import { loadPortfolioViewer } from './viewer-queries';
import { loadAccessContext } from '@/features/core/server/access';

const slugSchema = z.string().trim().min(1).max(40);

export async function getPortfolioAccountLabel(raw: unknown): Promise<ViewerLabel> {
  const slug = slugSchema.safeParse(raw);
  if (!slug.success) return 'login';
  return viewerLabelKey(await loadPortfolioViewer(slug.data));
}

/**
 * 메인페이지 오른쪽 위 계정 칸 (2026-11): 로그인 안 함 → '로그인' 버튼 / 로그인함 → 사람 아이콘 메뉴(이름 · 마이페이지 또는 관리 페이지 · 로그아웃)
 * 이름은 로그인한 본인의 표시 이름만 (다른 사람 정보 없음)
 */
export async function getPortfolioAccount(
  raw: unknown,
): Promise<{ label: ViewerLabel; name: string | null }> {
  const label = await getPortfolioAccountLabel(raw);
  if (label === 'login') return { label, name: null };
  const ctx = await loadAccessContext();
  return { label, name: ctx?.displayName ?? null };
}

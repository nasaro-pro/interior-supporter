// 포트폴리오 권한 단계 (DB private.portfolio_level_for 와 같은 규칙) — 화면에서 버튼을 숨기고 액션이 먼저 막는다. 최종 판정은 RLS·트리거
//  full : 대표·관리자, 또는 '전체 관리'를 받은 담당자 — 전부
//  works: '사례 올리기'를 받은 담당자 — 자기 담당 프로젝트의 '초안' 사례만 (사진·공간·비포/애프터·동의 기록)
//  none : 탭은 보이지만 권한 요청만
import type { MemberRole } from '@/shared/contracts/domain';

export const PORTFOLIO_LEVELS = ['none', 'works', 'full'] as const;
export type PortfolioLevel = (typeof PORTFOLIO_LEVELS)[number];

export function normalizeLevel(v: unknown): PortfolioLevel {
  return v === 'works' || v === 'full' ? v : 'none';
}

/** 역할 + 구성원 행의 portfolio_access → 단계 */
export function portfolioLevel(role: MemberRole, memberAccess: unknown): PortfolioLevel {
  if (role === 'owner' || role === 'manager') return 'full';
  return normalizeLevel(memberAccess);
}

export type PortfolioAction =
  'settings' | 'publish' | 'feature' | 'reorder' | 'createWork' | 'editWork';

/** 단계별로 할 수 있는 일 (editWork 는 아래 canEditWork 로 사례마다 다시 본다) */
export function canDo(level: PortfolioLevel, action: PortfolioAction): boolean {
  if (level === 'full') return true;
  if (level === 'works') return action === 'createWork' || action === 'editWork';
  return false;
}

/** 이 사례를 고칠 수 있나 — works 는 자기 담당 프로젝트의 초안만 */
export function canEditWork(
  level: PortfolioLevel,
  work: { status: 'draft' | 'published'; projectId: string | null },
  myProjectIds: ReadonlySet<string>,
): boolean {
  if (level === 'full') return true;
  if (level !== 'works') return false;
  return work.status === 'draft' && work.projectId !== null && myProjectIds.has(work.projectId);
}

/** 권한 요청에서 고를 수 있는 단계 (지금보다 높은 것만) */
export function requestableLevels(level: PortfolioLevel): ('works' | 'full')[] {
  if (level === 'none') return ['works', 'full'];
  if (level === 'works') return ['full'];
  return [];
}

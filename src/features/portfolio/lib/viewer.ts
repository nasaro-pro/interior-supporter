// 공개 포트폴리오를 보는 사람이 이 업체와 어떤 관계인지 → 머리 버튼 이름과 갈 곳 (순수 함수, 테스트 대상)
import { withQuery } from '@/features/core/url';
import { routes } from '@/shared/contracts/routes';

export type PortfolioViewer =
  | { role: 'guest' }
  | { role: 'none' }
  | { role: 'staff' }
  | { role: 'customer'; projectIds: string[] };

/** RPC portfolio_viewer 의 jsonb → 타입. 모르는 모양이면 손님으로 (버튼은 '로그인') */
export function parseViewer(raw: unknown): PortfolioViewer {
  if (!raw || typeof raw !== 'object') return { role: 'guest' };
  const r = raw as { role?: unknown; projects?: unknown };
  if (r.role === 'staff') return { role: 'staff' };
  if (r.role === 'none') return { role: 'none' };
  if (r.role === 'customer' && Array.isArray(r.projects)) {
    const projectIds = r.projects
      .map((p) => (p && typeof p === 'object' ? (p as { id?: unknown }).id : null))
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (projectIds.length) return { role: 'customer', projectIds };
  }
  return { role: 'guest' };
}

export type ViewerLabel = 'login' | 'myHome' | 'manage' | 'workspace';

/**
 * 머리 버튼 문구 키 (messages portfolio.account.*)
 * 2026-11: 로그인했지만 이 업체와 관계 없는 계정(현장 작업자 · 다른 업체 직원)은 '내 작업 화면' —
 * 계정 메뉴가 보여야 로그아웃하고 다른 계정으로 바꿔 들어올 수 있다
 */
export function viewerLabelKey(v: PortfolioViewer): ViewerLabel {
  if (v.role === 'staff') return 'manage';
  if (v.role === 'customer') return 'myHome';
  if (v.role === 'none') return 'workspace';
  return 'login';
}

/**
 * /c/{slug}/my 가 보낼 곳.
 *  손님 → 로그인 (끝나면 다시 /c/{slug}/my 로 돌아와 한 번 더 판단)
 *  직원 → 그 업체 첫 화면(대시보드) · 고객 → 우리 집 홈
 *  관계 없음 → 자기 역할(현장 · 다른 업체 · 다른 업체 고객)이 있으면 영역 선택(역할 1개면 그 화면으로 바로),
 *             역할이 하나도 없으면 포트폴리오로 돌아가 안내
 */
export function viewerDestination(v: PortfolioViewer, slug: string, hasOwnArea = false): string {
  switch (v.role) {
    case 'guest':
      return routes.login(routes.portfolio.my(slug));
    case 'staff':
      return routes.app.home(slug);
    case 'customer':
      return routes.portal.project(v.projectIds[0]!, 'home'); // parseViewer 가 1개 이상을 보장
    case 'none':
      if (hasOwnArea) return routes.selectArea();
      return withQuery(routes.portfolio.home(slug), { my: 'none' });
  }
}

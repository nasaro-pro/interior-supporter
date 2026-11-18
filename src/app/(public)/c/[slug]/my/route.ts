// 공개 포트폴리오 → 로그인 / 마이홈 / 관리 페이지 갈림길 (PUB-10·11 머리 버튼)
// 화면 없음: 로그인 상태와 이 업체와의 관계(RPC)를 확인하고 바로 보낸다. 권한은 도착한 화면이 다시 확인한다
import type { NextRequest } from 'next/server';
import { normalizeSlug } from '@/features/core/server/access';
import {
  loadPortfolioViewer,
  portfolioDestination,
} from '@/features/portfolio/server/viewer-queries';
import { routes } from '@/shared/contracts/routes';
import { redirectPath } from '@/shared/lib/redirect';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const slug = normalizeSlug((await params).slug);
  if (!slug) return redirectPath(routes.landing());
  const viewer = await loadPortfolioViewer(slug);
  return redirectPath(await portfolioDestination(viewer, slug), 303);
}

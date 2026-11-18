// 고객 화면 미리보기 끝내기 (A) — 쿠키를 지우고 담당자 프로젝트 개요(권한 없으면 첫 화면)로
import type { NextRequest } from 'next/server';
import { findProjectAccess } from '@/features/core';
import { CUSTOMER_PREVIEW_COOKIE } from '@/features/core/server/customer-preview';
import { routes } from '@/shared/contracts/routes';
import { redirectPath } from '@/shared/lib/redirect';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const project = request.nextUrl.searchParams.get('project');
  const access = project ? await findProjectAccess(project, ['editor']) : null;
  const to = access ? routes.app.project(access.companySlug, access.projectId) : routes.landing();
  const res = redirectPath(to);
  res.cookies.delete(CUSTOMER_PREVIEW_COOKIE);
  return res;
}

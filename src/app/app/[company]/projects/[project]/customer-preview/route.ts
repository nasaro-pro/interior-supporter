// 담당자 → 고객 화면 미리보기 시작 (A) — 편집 권한 확인 후 쿠키를 심고 고객 홈으로 보낸다
// 권한이 없거나 다른 업체 경로면 404 (존재 숨김). 미리보기는 읽기 전용 (core/server/customer-preview.ts)
import { NextResponse, type NextRequest } from 'next/server';
import { findProjectAccess } from '@/features/core';
import {
  CUSTOMER_PREVIEW_COOKIE,
  CUSTOMER_PREVIEW_MAX_AGE,
} from '@/features/core/server/customer-preview';
import { routes } from '@/shared/contracts/routes';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ company: string; project: string }> },
) {
  const { company, project } = await params;
  const access = await findProjectAccess(project, ['editor']);
  if (!access || access.companySlug.toLowerCase() !== decodeURIComponent(company).toLowerCase()) {
    return new NextResponse(null, { status: 404 });
  }
  const res = NextResponse.redirect(new URL(routes.portal.project(project, 'home'), request.url));
  res.cookies.set(CUSTOMER_PREVIEW_COOKIE, project, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: CUSTOMER_PREVIEW_MAX_AGE,
  });
  return res;
}

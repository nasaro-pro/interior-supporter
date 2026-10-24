// src/app/app/[company]/page.tsx (A) — 업체 루트는 프로젝트 목록(PM-01)으로. 별도 대시보드 없음 (P-11)
import { redirect } from 'next/navigation';
import { routes } from '@/shared/contracts/routes';

export default async function CompanyRoot({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  redirect(routes.app.projects(decodeURIComponent(company)));
}

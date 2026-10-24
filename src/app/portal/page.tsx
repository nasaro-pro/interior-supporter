// src/app/portal/page.tsx (A) — /portal → 내 프로젝트(CL-01)
import { redirect } from 'next/navigation';
import { routes } from '@/shared/contracts/routes';

export default function PortalRoot() {
  redirect(routes.portal.projects());
}

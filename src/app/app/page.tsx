// src/app/app/page.tsx (A) — /app 은 영역 선택(AUTH-05)으로
import { redirect } from 'next/navigation';
import { routes } from '@/shared/contracts/routes';

export default function AppRoot() {
  redirect(routes.selectArea());
}

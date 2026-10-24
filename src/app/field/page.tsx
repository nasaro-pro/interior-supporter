// src/app/field/page.tsx (A) — /field → 현장 사진(FW-01, C)
import { redirect } from 'next/navigation';
import { routes } from '@/shared/contracts/routes';

export default function FieldRoot() {
  redirect(routes.field.photos());
}

'use client';
// src/features/admin/components/use-admin-error-text.ts — 액션 오류 → 화면 문구 (사유가 있으면 사유, 없으면 오류 코드 문구)
import { useTranslations } from 'next-intl';
import type { AppError } from '@/shared/contracts/errors';

export function useAdminErrorText() {
  const t = useTranslations();
  return (error: AppError) => {
    const reason = error.fieldErrors?._form?.[0];
    if (reason) return t(`admin.${reason}` as Parameters<typeof t>[0]);
    return t(`errors.${error.code}`);
  };
}

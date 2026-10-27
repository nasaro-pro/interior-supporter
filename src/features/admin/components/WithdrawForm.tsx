'use client';
// src/features/admin/components/WithdrawForm.tsx — 본인 탈퇴 (A10). 확인 체크 후 제출, 성공하면 서버가 첫 화면으로 보낸다
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@/shared/ui/checkbox';
import { FieldError, SubmitButton } from '@/shared/ui/form-parts';
import { Label } from '@/shared/ui/label';
import { withdrawMe } from '../server/actions';
import { useAdminErrorText } from './use-admin-error-text';

export function WithdrawForm() {
  const t = useTranslations('admin.withdraw');
  const errorText = useAdminErrorText();
  const [state, action] = useActionState(withdrawMe, null);
  const error = state && !state.ok ? state.error : null;
  const formError = error && !error.fieldErrors?.confirm ? errorText(error) : null;

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex items-start gap-2">
        <Checkbox id="withdraw-confirm" name="confirm" aria-describedby="withdraw-confirm-error" />
        <Label htmlFor="withdraw-confirm">{t('confirmLabel')}</Label>
      </div>
      <FieldError id="withdraw-confirm-error" errors={error?.fieldErrors?.confirm} />
      {formError ? (
        <p role="alert" className="text-destructive text-sm">
          {formError}
        </p>
      ) : null}
      <div>
        <SubmitButton variant="destructive" data-ui-key="withdraw-submit">
          {t('submit')}
        </SubmitButton>
      </div>
    </form>
  );
}

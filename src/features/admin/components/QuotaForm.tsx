'use client';
// src/features/admin/components/QuotaForm.tsx — 업체별 저장공간 한도 (A6). 비우면 사이트 기본값
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-parts';
import { Input } from '@/shared/ui/input';
import { bytesToGb } from '../lib/bytes';
import { setCompanyQuota } from '../server/actions';
import { useAdminErrorText } from './use-admin-error-text';

export function QuotaForm({
  companyId,
  quotaBytes,
}: {
  companyId: string;
  quotaBytes: number | null;
}) {
  const t = useTranslations('admin.company');
  const errorText = useAdminErrorText();
  const router = useRouter();
  const [value, setValue] = useState(quotaBytes === null ? '' : String(bytesToGb(quotaBytes)));
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await setCompanyQuota({ companyId, quotaGb: value.trim() === '' ? null : value });
      if (res.ok) {
        toast.success(t('quotaDone'));
        router.refresh();
      } else toast.error(errorText(res.error));
    });

  return (
    <div className="flex flex-col gap-3">
      <FormRow label={t('quotaLabel')} htmlFor="admin-quota" hint={t('quotaHint')}>
        <Input
          id="admin-quota"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="max-w-40"
          data-ui-key="admin-quota-input"
        />
      </FormRow>
      <div>
        <Button
          size="sm"
          onClick={save}
          disabled={pending}
          aria-busy={pending}
          data-ui-key="admin-quota-save"
        >
          {t('quotaSave')}
        </Button>
      </div>
    </div>
  );
}

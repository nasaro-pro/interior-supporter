'use client';
// src/features/admin/components/SiteSettingsForm.tsx — 업로드 한도·기본 저장공간 (A6). 화면은 MB·GB, 저장은 바이트
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { AppError } from '@/shared/contracts/errors';
import { Button } from '@/shared/ui/button';
import { firstFieldError, FormRow } from '@/shared/ui/form-parts';
import { Input } from '@/shared/ui/input';
import { bytesToGb, bytesToMb } from '../lib/bytes';
import { SETTINGS_RANGE } from '../schema';
import { updateSiteSettings } from '../server/actions';
import type { SiteSettings } from '../types';
import { useAdminErrorText } from './use-admin-error-text';

type Field = 'photoMaxMb' | 'photoBatchMax' | 'designMaxMb' | 'defaultQuotaGb';

export function SiteSettingsForm({ settings }: { settings: SiteSettings }) {
  const t = useTranslations('admin.settings');
  const errorText = useAdminErrorText();
  const router = useRouter();
  const [values, setValues] = useState<Record<Field, string>>({
    photoMaxMb: String(bytesToMb(settings.photoMaxBytes)),
    photoBatchMax: String(settings.photoBatchMax),
    designMaxMb: String(bytesToMb(settings.designMaxBytes)),
    defaultQuotaGb:
      settings.defaultQuotaBytes === null ? '' : String(bytesToGb(settings.defaultQuotaBytes)),
  });
  const [error, setError] = useState<AppError | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await updateSiteSettings(values);
      if (res.ok) {
        setError(null);
        toast.success(t('saved'));
        router.refresh();
      } else {
        setError(res.error);
        toast.error(errorText(res.error));
      }
    });

  const field = (name: Field, range?: { min: number; max: number }, hint?: string) => (
    <FormRow
      label={t(name)}
      htmlFor={`admin-${name}`}
      hint={hint ?? (range ? `${range.min} ~ ${range.max}` : undefined)}
      errors={error?.fieldErrors?.[name]}
    >
      <Input
        id={`admin-${name}`}
        inputMode="decimal"
        value={values[name]}
        onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
        className="max-w-40"
        aria-invalid={firstFieldError(error, name) ? true : undefined}
      />
    </FormRow>
  );

  return (
    <form
      className="flex max-w-xl flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {field('photoMaxMb', SETTINGS_RANGE.photoMaxMb)}
      {field('photoBatchMax', SETTINGS_RANGE.photoBatchMax)}
      {field('designMaxMb', SETTINGS_RANGE.designMaxMb)}
      {field('defaultQuotaGb', undefined, t('defaultQuotaHint'))}
      <div>
        <Button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          data-ui-key="admin-settings-save"
        >
          {t('save')}
        </Button>
      </div>
    </form>
  );
}

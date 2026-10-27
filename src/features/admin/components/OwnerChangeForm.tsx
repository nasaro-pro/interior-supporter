'use client';
// src/features/admin/components/OwnerChangeForm.tsx — 업체 소유자 변경 (A4). 구성원 중에서 고르고 확인 후 실행
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { FormRow } from '@/shared/ui/form-parts';
import { NativeSelect } from '@/shared/ui/native-fields';
import { changeCompanyOwner } from '../server/actions';
import type { AdminMemberRow } from '../types';
import { useAdminErrorText } from './use-admin-error-text';

export function OwnerChangeForm({
  companyId,
  members,
}: {
  companyId: string;
  members: AdminMemberRow[];
}) {
  const t = useTranslations('admin.company');
  const errorText = useAdminErrorText();
  const candidates = members.filter((m) => m.role !== 'owner');
  const [userId, setUserId] = useState('');
  const chosen = candidates.find((m) => m.userId === userId);

  return (
    <div className="flex flex-col gap-3">
      <FormRow label={t('newOwner')} htmlFor="admin-new-owner" hint={t('changeOwnerHint')}>
        <NativeSelect
          id="admin-new-owner"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          data-ui-key="admin-new-owner"
        >
          <option value="">{t('chooseMember')}</option>
          {candidates.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.displayName} · {t(`role.${m.role}`)}
            </option>
          ))}
        </NativeSelect>
      </FormRow>
      <div>
        {chosen ? (
          <ConfirmDialog
            uiKey="admin-change-owner"
            destructive={false}
            trigger={t('changeOwner')}
            title={t('changeOwnerConfirm', { name: chosen.displayName })}
            body={t('changeOwnerHint')}
            confirmLabel={t('changeOwner')}
            successMessage={t('changeOwnerDone')}
            action={() => changeCompanyOwner({ companyId, newOwnerId: chosen.userId })}
            onError={(e) => toast.error(errorText(e))}
          />
        ) : (
          <Button variant="outline" size="sm" disabled data-ui-key="admin-change-owner">
            {t('changeOwner')}
          </Button>
        )}
      </div>
    </div>
  );
}

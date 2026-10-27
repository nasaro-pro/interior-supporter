'use client';
// src/features/admin/components/UserActions.tsx — 계정 한 줄의 처리 버튼 (A5): 정지·해제, 재설정 링크, 익명화
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { anonymizeUser, issuePasswordResetLink, setUserSuspended } from '../server/actions';
import type { AdminUserRow } from '../types';
import { useAdminErrorText } from './use-admin-error-text';

export function UserActions({ user }: { user: AdminUserRow }) {
  const t = useTranslations('admin.user');
  const errorText = useAdminErrorText();
  const [link, setLink] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (user.anonymizedAt || user.isAdmin) return null;
  const name = user.displayName;
  const suspended = user.suspendedAt !== null;

  const askLink = () =>
    start(async () => {
      const res = await issuePasswordResetLink({ userId: user.id });
      if (res.ok) setLink(res.data.link);
      else toast.error(errorText(res.error));
    });

  return (
    <div className="flex flex-wrap gap-1">
      <ConfirmDialog
        uiKey={`admin-user-suspend-${user.id}`}
        destructive={!suspended}
        trigger={suspended ? t('unsuspend') : t('suspend')}
        title={suspended ? t('unsuspendConfirm', { name }) : t('suspendConfirm', { name })}
        body={suspended ? '' : t('suspendBody')}
        confirmLabel={suspended ? t('unsuspend') : t('suspend')}
        successMessage={suspended ? t('unsuspendDone') : t('suspendDone')}
        action={() => setUserSuspended({ userId: user.id, suspended: !suspended })}
        onError={(e) => toast.error(errorText(e))}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={askLink}
        disabled={pending}
        aria-busy={pending}
        data-ui-key="admin-user-reset"
      >
        {t('resetLink')}
      </Button>
      <ConfirmDialog
        uiKey={`admin-user-anonymize-${user.id}`}
        trigger={t('anonymize')}
        title={t('anonymizeConfirm', { name })}
        body={t('anonymizeBody')}
        confirmLabel={t('anonymize')}
        successMessage={t('anonymizeDone')}
        action={() => anonymizeUser({ userId: user.id })}
        onError={(e) => toast.error(errorText(e))}
      />
      <Dialog open={link !== null} onOpenChange={(open) => !open && setLink(null)}>
        <DialogContent data-ui-key="admin-user-reset-dialog">
          <DialogHeader>
            <DialogTitle>{t('resetLinkTitle')}</DialogTitle>
            <DialogDescription>{t('resetLinkBody')}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              readOnly
              value={link ?? ''}
              aria-label={t('resetLinkTitle')}
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(link ?? '');
                toast.success(t('copied'));
              }}
            >
              {t('copy')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

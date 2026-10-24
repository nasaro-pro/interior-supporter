'use client';
// PM-14 / PM-15 재확인 요청 (REQ-121) — 사유 필수. 확정 상태일 때만 보인다. 위험 동작 → AlertDialog
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { RotateCcw } from 'lucide-react';
import { requestReconfirm } from '@/features/designs/server/confirm-actions';
import type { ConfirmTargetType } from '@/features/designs/schema';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { FormField, useFieldErrorText } from '@/shared/ui/form-parts';
import { useActionErrorText } from '@/shared/ui/action-error';
import { Textarea } from '@/shared/ui/textarea';

export function ReconfirmRequestButton({
  projectId,
  targetType,
  targetId,
}: {
  projectId: string;
  targetType: ConfirmTargetType;
  targetId: string;
}) {
  const t = useTranslations(targetType);
  const fieldText = useFieldErrorText();
  const actionText = useActionErrorText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const key = targetType === 'designs' ? 'design' : 'material';

  const run = () =>
    start(async () => {
      if (!reason.trim()) {
        setError(fieldText('required'));
        return;
      }
      const res = await requestReconfirm({ projectId, targetType, targetId, reason });
      if (!res.ok) {
        setError(actionText(res.error));
        if (res.error.code === 'VERSION_CONFLICT' || res.error.code === 'CONFLICT')
          router.refresh();
        return;
      }
      setOpen(false);
      setReason('');
      setError(null);
      toast.success(t('toast.reconfirmRequested'));
      router.refresh();
    });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        data-ui-key={`${key}-reconfirm-open`}
      >
        <RotateCcw aria-hidden />
        {t('action.requestReconfirm')}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setError(null);
        }}
        title={t('reconfirm.title')}
        body={t('reconfirm.body')}
        confirmLabel={t('action.requestReconfirm')}
        pending={pending}
        onConfirm={run}
        uiKey={`${key}-reconfirm-dialog`}
      >
        <FormField label={t('field.reason')} error={error ?? undefined} required>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            data-ui-key={`${key}-reconfirm-reason`}
          />
        </FormField>
      </ConfirmDialog>
    </>
  );
}

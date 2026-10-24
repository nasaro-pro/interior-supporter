'use client';
// 처리 상태 변경 PM-16 — 현재 상태에서 허용된 전환만 (REQ-205, ST-200)
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { REQUEST_TRANSITIONS, type RequestStatus } from '@/shared/contracts/domain';
import type { AppError } from '@/shared/contracts/errors';
import { ActionError } from '@/shared/ui/action-error';
import { Button } from '@/shared/ui/button';
import { NativeSelect } from '@/shared/ui/native-fields';
import { changeRequestStatus } from '../server/actions';

export function RequestStatusSelect({
  projectId,
  requestId,
  status,
  version,
}: {
  projectId: string;
  requestId: string;
  status: RequestStatus;
  version: number;
}) {
  const t = useTranslations('requests');
  const router = useRouter();
  const options = REQUEST_TRANSITIONS[status];
  const [to, setTo] = useState<RequestStatus>(options[0] ?? status);
  const [error, setError] = useState<AppError | null>(null);
  const [pending, startTransition] = useTransition();

  const apply = () =>
    startTransition(async () => {
      const res = await changeRequestStatus({
        projectId,
        requestId,
        baseVersion: version,
        from: status,
        to,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      toast.success(t('toast.statusChanged', { status: t(`status.${res.data.status}`) }));
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="request-status-to" className="text-sm font-medium">
        {t('action.changeStatus')}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          id="request-status-to"
          value={to}
          onChange={(e) => setTo(e.target.value as RequestStatus)}
          aria-describedby="request-status-hint"
          className="w-40"
        >
          {options.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </NativeSelect>
        <Button
          variant="secondary"
          onClick={apply}
          pending={pending}
          data-ui-key="request-status-apply"
        >
          {t('action.changeStatus')}
        </Button>
      </div>
      <p id="request-status-hint" className="text-muted-foreground text-meta">
        {t('detail.statusTransitionHint')}
      </p>
      <ActionError error={error} />
    </div>
  );
}

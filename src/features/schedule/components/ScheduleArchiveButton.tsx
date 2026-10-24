'use client';
// 일정 보관·복원 PM-18 — 삭제 없음 (POL-020). 보관은 확인 대화상자(AlertDialog), 복원은 즉시
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Archive, ArchiveRestore } from 'lucide-react';
import type { AppError } from '@/shared/contracts/errors';
import { ActionError } from '@/shared/ui/action-error';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { setScheduleEventArchived } from '../server/actions';

export function ScheduleArchiveButton({
  projectId,
  eventId,
  version,
  archived,
}: {
  projectId: string;
  eventId: string;
  version: number;
  archived: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [error, setError] = useState<AppError | null>(null);
  const [pending, startTransition] = useTransition();

  const run = async (next: boolean) => {
    const res = await setScheduleEventArchived({
      projectId,
      eventId,
      baseVersion: version,
      archived: next,
    });
    if (!res.ok) return setError(res.error);
    setError(null);
    toast.success(next ? t('schedule.toast.archived') : t('schedule.toast.restored'));
    router.refresh();
  };

  return (
    <div className="flex flex-col items-start gap-2">
      {archived ? (
        <Button
          variant="outline"
          onClick={() => startTransition(() => run(false))}
          pending={pending}
          data-ui-key="schedule-restore"
        >
          <ArchiveRestore aria-hidden />
          {t('common.action.restore')}
        </Button>
      ) : (
        // 트리거 schedule-archive · 패널 schedule-archive-dialog · 확인 schedule-archive-confirm
        <ConfirmDialog
          trigger={
            <>
              <Archive aria-hidden />
              {t('common.action.archive')}
            </>
          }
          triggerSize="default"
          uiKey="schedule-archive"
          title={t('common.confirm.archive.title')}
          body={t('common.confirm.archive.body')}
          confirmLabel={t('common.action.archive')}
          onConfirm={() => run(true)}
        />
      )}
      <ActionError error={error} />
    </div>
  );
}

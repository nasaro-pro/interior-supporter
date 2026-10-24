'use client';
// CL-14 / CL-15 확정 버튼 (REQ-120, 02 문서 6.5) — 확정권 고객에게만 그린다. 3상태:
//   none            → [이 도안/자재 확정]
//   confirmed       → "○○님이 2026-10-06 14:20 확정(리비전 2)" (버튼 없음)
//   needs_reconfirm → 재확인 필요 배지(attention) + [변경됨 — 다시 확정]
// 클릭 → AlertDialog(확정 대상 요약) → RPC. STALE_REVISION 이면 "내용이 바뀌었습니다…" + 새로고침
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CircleCheck, RefreshCw } from 'lucide-react';
import type { ConfirmState } from '@/shared/contracts/domain';
import type { AppError } from '@/shared/contracts/errors';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { Notice } from '@/shared/ui/notice';
import { useActionErrorText } from '@/shared/ui/action-error';
import { confirmTarget } from '@/features/designs/server/confirm-actions';
import type { ConfirmTargetType } from '@/features/designs/schema';
import { ConfirmStateBadge } from '@/features/designs/components/StateBadges';

export function ConfirmButton({
  projectId,
  targetType,
  targetId,
  revision,
  state,
  summary,
  confirmedLine,
}: {
  projectId: string;
  targetType: ConfirmTargetType;
  targetId: string;
  /** 화면이 보고 있는 리비전 (도안 = 현재 버전, 자재 = revision) */
  revision: number;
  state: ConfirmState;
  /** 대화상자에 보여 줄 확정 대상 요약 */
  summary: string;
  /** confirmed 일 때 보여 줄 기록 문구 (designs.record.line 으로 서버에서 만든 값) */
  confirmedLine?: string | null;
}) {
  const t = useTranslations(targetType);
  const tc = useTranslations('common');
  const actionText = useActionErrorText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [failure, setFailure] = useState<AppError | null>(null);
  const key = targetType === 'designs' ? 'design' : 'material';

  if (state === 'confirmed') {
    return confirmedLine ? (
      <Notice tone="positive" icon={CircleCheck} role="status">
        <span data-ui-key={`${key}-confirmed-line`}>{confirmedLine}</span>
      </Notice>
    ) : null;
  }

  const run = () =>
    start(async () => {
      setFailure(null);
      const res = await confirmTarget({ projectId, targetType, targetId, revision });
      setOpen(false);
      if (!res.ok) {
        setFailure(res.error);
        if (res.error.code !== 'STALE_REVISION') toast.error(actionText(res.error));
        return;
      }
      toast.success(t('toast.confirmed'));
      router.refresh();
    });

  const label = state === 'needs_reconfirm' ? t('action.reconfirm') : t('action.confirm');

  return (
    <div className="flex flex-col gap-2">
      {state === 'needs_reconfirm' ? (
        <div className="flex flex-col items-start gap-2">
          <ConfirmStateBadge state="needs_reconfirm" label={t('confirmState.needs_reconfirm')} />
          <Notice tone="attention">{t('state.needsReconfirm')}</Notice>
        </div>
      ) : null}
      {failure?.code === 'STALE_REVISION' ? (
        <div role="alert" className="flex flex-wrap items-center gap-2">
          <Notice tone="caution">{t('confirm.stale')}</Notice>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFailure(null);
              router.refresh();
            }}
            data-ui-key={`${key}-confirm-refresh`}
          >
            <RefreshCw aria-hidden />
            {tc('action.refresh')}
          </Button>
        </div>
      ) : null}
      <div>
        <Button
          onClick={() => setOpen(true)}
          disabled={pending}
          data-ui-key={`${key}-confirm-open`}
        >
          <CircleCheck aria-hidden />
          {label}
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        destructive={false}
        title={t('confirm.title')}
        body={
          <>
            <span className="text-foreground block font-medium">{summary}</span>
            <span className="mt-1 block">
              {targetType === 'designs' ? t('confirm.body', { no: revision }) : t('confirm.body')}
            </span>
          </>
        }
        confirmLabel={label}
        pending={pending}
        onConfirm={run}
        uiKey={`${key}-confirm-dialog`}
      />
    </div>
  );
}

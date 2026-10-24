'use client';
// src/shared/ui/record-actions.tsx (A) — 보관/복원 · 고객 공개 전환 버튼 (낙관적 잠금 baseVersion 액션, REQ-106·113·133)
// 서버 컴포넌트에서 바로 쓸 수 있게 Server Action + 직렬화 가능한 payload 를 받는다
import { useState, useTransition, type ComponentProps } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { isConflictCode, useActionErrorText } from '@/shared/ui/action-error';
import type { ActionResult } from '@/shared/contracts/errors';

export type VersionedAction = (raw: unknown) => Promise<ActionResult<unknown>>;
type ButtonSize = ComponentProps<typeof Button>['size'];

function useRunner(action: VersionedAction, onDone: (ok: boolean) => void) {
  const router = useRouter();
  const errorText = useActionErrorText();
  const [pending, start] = useTransition();
  const run = (raw: Record<string, unknown>, successMessage: string) =>
    start(async () => {
      const res = await action(raw);
      onDone(res.ok);
      if (!res.ok) {
        toast.error(errorText(res.error));
        if (isConflictCode(res.error.code)) router.refresh();
        return;
      }
      toast.success(successMessage);
      router.refresh();
    });
  return { pending, run };
}

/** 보관(확인 대화상자) / 복원(즉시) */
export function ArchiveToggle({
  action,
  payload,
  archived,
  uiKey,
  size = 'sm',
}: {
  action: VersionedAction;
  payload: Record<string, unknown>;
  archived: boolean;
  uiKey: string;
  size?: ButtonSize;
}) {
  const t = useTranslations('common');
  const [asking, setAsking] = useState(false);
  const { pending, run } = useRunner(action, () => setAsking(false));
  const go = () =>
    run({ ...payload, archived: !archived }, archived ? t('toast.restored') : t('toast.archived'));

  return (
    <>
      <Button
        variant="outline"
        size={size}
        pending={pending && !asking}
        disabled={pending}
        onClick={() => (archived ? go() : setAsking(true))}
        data-ui-key={uiKey}
      >
        {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
        {archived ? t('action.restore') : t('action.archive')}
      </Button>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t('confirm.archive.title')}
        body={t('confirm.archive.body')}
        confirmLabel={t('action.archive')}
        pending={pending}
        onConfirm={go}
        uiKey={`${uiKey}-dialog`}
      />
    </>
  );
}

/** 고객 공개 전환 — role="switch". confirm 을 주면 공개 전에 확인 */
export function PublishToggle({
  action,
  payload,
  isPublic,
  uiKey,
  confirm,
  publishedToast,
  size = 'sm',
}: {
  action: VersionedAction;
  payload: Record<string, unknown>;
  isPublic: boolean;
  uiKey: string;
  confirm?: { title: string; body: string };
  publishedToast?: string;
  size?: ButtonSize;
}) {
  const t = useTranslations('common');
  const [asking, setAsking] = useState(false);
  const { pending, run } = useRunner(action, () => setAsking(false));
  const go = () =>
    run(
      { ...payload, isPublic: !isPublic },
      isPublic ? t('toast.unpublished') : (publishedToast ?? t('toast.published')),
    );

  return (
    <>
      <Button
        variant="outline"
        size={size}
        role="switch"
        aria-checked={isPublic}
        pending={pending && !asking}
        disabled={pending}
        onClick={() => (!isPublic && confirm ? setAsking(true) : go())}
        data-ui-key={uiKey}
      >
        {isPublic ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
        {t('visibility.label')}: {isPublic ? t('visibility.public') : t('visibility.private')}
      </Button>
      {confirm ? (
        <ConfirmDialog
          open={asking}
          onOpenChange={setAsking}
          title={confirm.title}
          body={confirm.body}
          confirmLabel={t('action.publish')}
          destructive={false}
          pending={pending}
          onConfirm={go}
          uiKey={`${uiKey}-dialog`}
        />
      ) : null}
    </>
  );
}

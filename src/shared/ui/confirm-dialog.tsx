'use client';
// src/shared/ui/confirm-dialog.tsx (A) — 위험 동작(보관·회수·폐기·확정) 확인 대화상자 (02 문서 5장 폼 규칙)
// 실행 방식 두 가지: ① bind 된 Server Action(action) ② 콜백(onConfirm). 트리거형(비제어)·제어형 모두 지원
import { useState, useTransition, type ComponentProps, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog';
import { Button } from '@/shared/ui/button';
import { isConflictCode } from '@/shared/ui/action-error';
import type { ActionResult, AppError } from '@/shared/contracts/errors';

type ButtonVariant = ComponentProps<typeof Button>['variant'];
type ButtonSize = ComponentProps<typeof Button>['size'];

export type ConfirmDialogProps = {
  title: string;
  body: ReactNode;
  /** 본문 아래 추가 내용 (확정 대상 요약 등) */
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** 트리거 `uiKey`, 패널 `${uiKey}-dialog`(트리거 없으면 `uiKey`), 확인 `${uiKey}-confirm`, 취소 `${uiKey}-cancel` */
  uiKey: string;
  /** 위험 동작 강조 (기본 true) */
  destructive?: boolean;
  trigger?: ReactNode;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** ① bind 된 Server Action — 성공 시 닫기·toast·router.refresh() */
  action?: () => Promise<ActionResult<unknown>>;
  successMessage?: string;
  onSuccess?: (data: unknown) => void;
  /** 주면 기본 오류 toast 대신 호출 */
  onError?: (error: AppError) => void;
  /** ② 콜백 — Promise 를 돌려주면 끝날 때까지 실행 중 표시 */
  onConfirm?: () => void | Promise<unknown>;
  /** 바깥에서 관리하는 실행 중 상태 */
  pending?: boolean;
};

export function ConfirmDialog({
  title,
  body,
  children,
  confirmLabel,
  cancelLabel,
  uiKey,
  destructive = true,
  trigger,
  triggerVariant = 'outline',
  triggerSize = 'sm',
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  action,
  successMessage,
  onSuccess,
  onError,
  onConfirm,
  pending: externalPending = false,
}: ConfirmDialogProps) {
  const t = useTranslations();
  const router = useRouter();
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const [running, start] = useTransition();
  const pending = running || externalPending;
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : innerOpen;

  const setOpen = (next: boolean, force = false) => {
    if (!next && pending && !force) return;
    if (!controlled) setInnerOpen(next);
    onOpenChange?.(next);
  };

  const run = () => {
    if (action) {
      start(async () => {
        const res = await action();
        if (res.ok) {
          setOpen(false, true);
          if (successMessage) toast.success(successMessage);
          onSuccess?.(res.data);
          router.refresh();
          return;
        }
        if (onError) onError(res.error);
        else
          toast.error(t(`errors.${res.error.code}`), {
            description: res.error.ref
              ? t('common.state.errorRef', { ref: res.error.ref })
              : undefined,
          });
        if (isConflictCode(res.error.code)) router.refresh();
      });
      return;
    }
    const result = onConfirm?.();
    if (result instanceof Promise) {
      start(async () => {
        await result;
        if (!controlled) setInnerOpen(false);
      });
    } else if (!controlled) {
      setInnerOpen(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => setOpen(next)}>
      {trigger !== undefined ? (
        <AlertDialogTrigger
          render={<Button variant={triggerVariant} size={triggerSize} data-ui-key={uiKey} />}
        >
          {trigger}
        </AlertDialogTrigger>
      ) : null}
      <AlertDialogContent data-ui-key={trigger !== undefined ? `${uiKey}-dialog` : uiKey}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription render={<div />}>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        {children ? <div className="text-sm">{children}</div> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} data-ui-key={`${uiKey}-cancel`}>
            {cancelLabel ?? t('common.action.cancel')}
          </AlertDialogCancel>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={run}
            pending={pending}
            data-ui-key={`${uiKey}-confirm`}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

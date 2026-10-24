'use client';
// src/shared/ui/form-sheet.tsx (A) — 폼 Sheet 표준: 데스크톱 우측(최대 512px) / 모바일 전체 화면 (02 문서 5장, 00 헌법 10.3)
// base-ui Dialog: 포커스 가두기 · Esc 닫기 · 닫힌 뒤 트리거로 포커스 복귀 · 닫히면 본문 언마운트(입력 초기화)
import { useState, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/shared/ui/sheet';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';

type ButtonVariant = ComponentProps<typeof Button>['variant'];
type ButtonSize = ComponentProps<typeof Button>['size'];

export type FormSheetProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** 아래 고정 영역 (취소·저장). 제출 버튼은 form="<form id>" 로 본문 form 에 연결 */
  footer?: ReactNode;
  /** 트리거 버튼 문구 — 주면 트리거 버튼을 그린다 */
  triggerLabel?: ReactNode;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  triggerIcon?: ReactNode;
  /** 트리거를 직접 그릴 때 (base-ui render 요소) */
  trigger?: ReactElement;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 제출 중: Esc·바깥 클릭·닫기 버튼으로 닫히지 않는다 */
  busy?: boolean;
  /** 트리거 `${uiKey}-open`, 패널 `${uiKey}`, 닫기 `${uiKey}-close` */
  uiKey?: string;
  closeLabel?: string;
  className?: string;
};

export function FormSheet({
  title,
  description,
  children,
  footer,
  triggerLabel,
  triggerVariant = 'default',
  triggerSize,
  triggerIcon,
  trigger,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  busy = false,
  uiKey,
  closeLabel,
  className,
}: FormSheetProps) {
  const t = useTranslations('common');
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (next: boolean) => {
    if (!next && busy) return;
    if (controlledOpen === undefined) setInnerOpen(next);
    onOpenChange?.(next);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger ? (
        <SheetTrigger render={trigger} />
      ) : triggerLabel !== undefined ? (
        <SheetTrigger
          render={
            <Button
              variant={triggerVariant}
              size={triggerSize}
              data-ui-key={uiKey ? `${uiKey}-open` : undefined}
            />
          }
        >
          {triggerIcon}
          {triggerLabel}
        </SheetTrigger>
      ) : null}
      <SheetContent
        side="right"
        showCloseButton={false}
        data-ui-key={uiKey}
        className={cn(
          'bg-card gap-0 data-[side=right]:w-full data-[side=right]:max-w-none data-[side=right]:sm:max-w-lg',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
            {description ? (
              <SheetDescription render={<div />} className="text-meta mt-1">
                {description}
              </SheetDescription>
            ) : null}
          </div>
          <SheetClose
            disabled={busy}
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={closeLabel ?? t('action.close')}
                data-ui-key={uiKey ? `${uiKey}-close` : undefined}
              />
            }
          >
            <XIcon aria-hidden />
          </SheetClose>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t px-4 py-3 sm:px-6">
            {footer}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

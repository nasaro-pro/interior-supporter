'use client';
// D-32 · CU-05 도안 · 자재 상세 옆 메모 자리 — PC(lg 이상) 오른쪽 패널, 모바일 하단 '메모' 버튼 → 아래에서 올라오는 시트
// 패널 내용(서버에서 그린 메모 대화)은 그대로 받아 두 자리에 배치만 한다 (모바일 시트는 열 때만 그린다)
import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet';

export function MemoLayout({
  children,
  panel,
  count,
}: {
  children: ReactNode;
  panel: ReactNode;
  /** 메모 개수 (버튼 · 제목 옆 표시) */
  count: number;
}) {
  const t = useTranslations('requests');
  const [open, setOpen] = useState(false);
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">{children}</div>
      <aside
        aria-label={t('memo.title')}
        className="bg-card hidden max-h-[calc(100svh-8rem)] min-w-0 flex-col gap-3 overflow-y-auto rounded-lg border p-4 lg:sticky lg:top-20 lg:flex"
        data-ui-key="item-memo-panel"
      >
        <h3 className="font-semibold">
          {t('memo.title')}
          <span className="text-muted-foreground text-meta ms-2 tabular-nums">{count}</span>
        </h3>
        {panel}
      </aside>
      {/* 모바일 · 태블릿: 화면 아래 고정 버튼 (본문을 가리지 않게 여백 확보) */}
      <div className="h-14 lg:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center p-3 lg:hidden">
        <Button
          className="shadow-lg"
          onClick={() => setOpen(true)}
          data-ui-key="item-memo-open"
          aria-haspopup="dialog"
        >
          <MessageSquare aria-hidden />
          {t('memo.open', { count })}
        </Button>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85svh] overflow-y-auto rounded-t-xl lg:hidden"
          data-ui-key="item-memo-sheet"
        >
          <SheetHeader>
            <SheetTitle>{t('memo.title')}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4 pb-6">{open ? panel : null}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

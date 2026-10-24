'use client';
// 비교 이미지 보관 (PM-14) — 보관하면 비교 후보에서 빠진다. 위험 동작 → AlertDialog (표준 ConfirmDialog)
// data-ui-key: 트리거 design-preview-archive · 패널 design-preview-archive-dialog(-confirm/-cancel) 유지
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Archive } from 'lucide-react';
import { archiveDesignPreview } from '@/features/designs/server/actions';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';

export function PreviewArchiveButton({
  projectId,
  designId,
  id,
  label,
}: {
  projectId: string;
  designId: string;
  id: string;
  /** 보관할 이미지 이름 (버튼 접근 이름·대화상자 본문) */
  label: string;
}) {
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="xs"
        onClick={() => setOpen(true)}
        aria-label={`${tc('action.archive')}: ${label}`}
        data-ui-key="design-preview-archive"
      >
        <Archive aria-hidden />
        {tc('action.archive')}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        uiKey="design-preview-archive-dialog"
        title={tc('confirm.archive.title')}
        body={
          <>
            <span className="text-foreground block font-medium">{label}</span>
            <span className="mt-1 block">{tc('confirm.archive.body')}</span>
          </>
        }
        confirmLabel={tc('action.archive')}
        action={() => archiveDesignPreview({ projectId, designId, id })}
        successMessage={tc('toast.archived')}
      />
    </>
  );
}

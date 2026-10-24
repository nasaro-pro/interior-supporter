'use client';
// PM-14 새 버전 올리기 (REQ-102) — 이전 버전은 보존, 확정 상태면 재확인 필요로 전환
import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { FormSheet } from '@/shared/ui/form-sheet';
import { FormField } from '@/shared/ui/form-parts';
import { useActionErrorText } from '@/shared/ui/action-error';
import { Input } from '@/shared/ui/input';
import { Notice } from '@/shared/ui/notice';
import { UploadField, UploadQueue, type UploadedFile } from '@/features/files';
import { addDesignVersion } from '@/features/designs/server/actions';

export function DesignVersionAddButton({
  projectId,
  companyId,
  designId,
  nextVersionNo,
  confirmed,
}: {
  projectId: string;
  companyId: string;
  designId: string;
  nextVersionNo: number;
  confirmed: boolean;
}) {
  const t = useTranslations('designs');
  const tc = useTranslations('common');
  const actionText = useActionErrorText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const onUploaded = useCallback((f: UploadedFile) => setFile(f), []);

  const busy = pending || uploading;
  const reset = () => {
    setOpen(false);
    setFile(null);
    setNote('');
  };
  /** 사용자 닫기 — 업로드·저장 중에는 닫지 않는다 */
  const close = () => {
    if (!busy) reset();
  };

  const submit = () =>
    start(async () => {
      if (!file) return;
      const res = await addDesignVersion({ projectId, designId, note, fileId: file.fileId });
      if (!res.ok) {
        toast.error(actionText(res.error));
        return;
      }
      toast.success(
        res.data.reconfirm
          ? t('toast.versionAddedReconfirm')
          : t('toast.versionAdded', { no: nextVersionNo }),
      );
      reset();
      router.refresh();
    });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        data-ui-key="design-version-open"
      >
        <Upload aria-hidden />
        {t('action.newVersion')}
      </Button>
      <FormSheet
        open={open}
        onOpenChange={(o) => (o ? setOpen(true) : close())}
        busy={busy}
        title={t('action.newVersion')}
        uiKey="design-version-sheet"
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={busy}>
              {tc('action.cancel')}
            </Button>
            <Button
              onClick={submit}
              disabled={uploading || !file}
              pending={pending}
              data-ui-key="design-version-submit"
            >
              {tc('action.save')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {confirmed ? <Notice tone="attention">{t('version.reconfirmWarning')}</Notice> : null}
          <UploadField label={t('field.original')} fileName={file?.name} required>
            <UploadQueue
              target={{ kind: 'design_original', projectId, companyId }}
              onUploaded={onUploaded}
              onBusyChange={setUploading}
              uiKey="design-version-file"
            />
          </UploadField>
          <FormField label={t('field.note')}>
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </FormField>
        </div>
      </FormSheet>
    </>
  );
}

'use client';
// PM-09 견적 등록 / PM-19 새 버전 Sheet (REQ-131) — PDF 20MB, 표시명·변경 설명 필수, 번호는 서버 부여
// 표준 FormSheet(base-ui Dialog) · FormField(aria 자동) · 견적에는 확정 버튼이 없다
import { useCallback, useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { FilePlus, Plus } from 'lucide-react';
import type { AppError } from '@/shared/contracts/errors';
import { routes } from '@/shared/contracts/routes';
import { Button } from '@/shared/ui/button';
import { FormSheet } from '@/shared/ui/form-sheet';
import { FormField, firstFieldError, useFieldErrorText } from '@/shared/ui/form-parts';
import { useActionErrorText } from '@/shared/ui/action-error';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { NativeCheckbox } from '@/shared/ui/native-fields';
import { Notice } from '@/shared/ui/notice';
import { UploadField, UploadQueue, type UploadedFile } from '@/features/files';
import { addEstimateVersion, createEstimate } from '@/features/estimates/server/actions';
import { estimateCreateSchema, estimateVersionAddSchema } from '@/features/estimates/schema';

export function EstimateFormSheetClient({
  mode,
  projectId,
  companyId,
  companySlug,
  estimateId,
}: {
  mode: 'create' | 'newVersion';
  projectId: string;
  companyId: string;
  companySlug: string;
  estimateId?: string;
}) {
  const t = useTranslations('estimates');
  const tc = useTranslations('common');
  const fieldText = useFieldErrorText();
  const actionText = useActionErrorText();
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [ids, setIds] = useState(() => ({
    id: crypto.randomUUID(),
    versionId: crypto.randomUUID(),
  }));
  const [title, setTitle] = useState('');
  const [versionLabel, setVersionLabel] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [local, setLocal] = useState<Record<string, string>>({});
  const [error, setError] = useState<AppError | null>(null);
  const [pending, start] = useTransition();
  const busy = pending || uploading;
  const onUploaded = useCallback((f: UploadedFile) => setFile(f), []);

  const openSheet = () => {
    setIds({ id: crypto.randomUUID(), versionId: crypto.randomUUID() });
    setTitle('');
    setVersionLabel('');
    setChangeNote('');
    setIsPublic(false);
    setFile(null);
    setLocal({});
    setError(null);
    setOpen(true);
  };

  const submit = () =>
    start(async () => {
      const common = { projectId, versionLabel, changeNote, fileId: file?.fileId ?? '', isPublic };
      const input =
        mode === 'create'
          ? { ...common, id: ids.id, versionId: ids.versionId, title }
          : { ...common, estimateId, versionId: ids.versionId };
      const check =
        mode === 'create'
          ? estimateCreateSchema.safeParse(input)
          : estimateVersionAddSchema.safeParse(input);
      if (!check.success) {
        const next: Record<string, string> = {};
        for (const issue of check.error.issues) next[String(issue.path[0])] ??= issue.message;
        setLocal(next);
        return;
      }
      setLocal({});
      setError(null);
      if (mode === 'create') {
        const res = await createEstimate(input);
        if (!res.ok) {
          setError(res.error);
          toast.error(actionText(res.error));
          return;
        }
        toast.success(t('toast.created'));
        setOpen(false);
        router.push(routes.app.estimate(companySlug, projectId, res.data.id, res.data.versionNo));
        return;
      }
      const res = await addEstimateVersion(input);
      if (!res.ok) {
        setError(res.error);
        toast.error(actionText(res.error));
        return;
      }
      toast.success(t('toast.versionAdded'));
      setOpen(false);
      if (estimateId)
        router.push(routes.app.estimate(companySlug, projectId, estimateId, res.data.versionNo));
    });

  const fe = (k: string) => {
    const msg = local[k] ?? firstFieldError(error, k);
    return msg ? fieldText(msg) : undefined;
  };
  const label = mode === 'create' ? t('action.create') : t('action.newVersion');

  return (
    <>
      {mode === 'create' ? (
        <Button onClick={openSheet} data-ui-key="estimate-create-open">
          <Plus aria-hidden />
          {label}
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={openSheet} data-ui-key="estimate-version-open">
          <FilePlus aria-hidden />
          {label}
        </Button>
      )}
      <FormSheet
        open={open}
        onOpenChange={setOpen}
        busy={busy}
        title={label}
        uiKey={mode === 'create' ? 'estimate-create-sheet' : 'estimate-version-sheet'}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              {tc('action.cancel')}
            </Button>
            <Button
              type="submit"
              form={formId}
              disabled={uploading || !file}
              pending={pending}
              data-ui-key="estimate-form-submit"
            >
              {tc('action.save')}
            </Button>
          </>
        }
      >
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) submit();
          }}
          noValidate
          className="flex flex-col gap-4"
        >
          <Notice tone="info">{t('form.noReplace')}</Notice>
          <UploadField label={t('field.file')} error={fe('fileId')} fileName={file?.name} required>
            <UploadQueue
              target={{ kind: 'estimate_pdf', projectId, companyId }}
              onUploaded={onUploaded}
              onBusyChange={setUploading}
              uiKey="estimate-file-upload"
            />
          </UploadField>
          {mode === 'create' ? (
            <FormField label={t('field.title')} error={fe('title')} required>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                data-ui-key="estimate-form-title"
              />
            </FormField>
          ) : null}
          <FormField
            label={t('field.versionLabel')}
            hint={t('form.versionLabelHint')}
            error={fe('versionLabel')}
            required
          >
            <Input
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              maxLength={40}
              data-ui-key="estimate-form-version-label"
            />
          </FormField>
          <FormField
            label={t('field.changeNote')}
            hint={t('form.changeNoteHint')}
            error={fe('changeNote')}
            required
          >
            <Textarea
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              rows={4}
              maxLength={1000}
              data-ui-key="estimate-form-change-note"
            />
          </FormField>
          <NativeCheckbox
            label={tc('visibility.label')}
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            data-ui-key="estimate-form-public"
          />
        </form>
      </FormSheet>
    </>
  );
}

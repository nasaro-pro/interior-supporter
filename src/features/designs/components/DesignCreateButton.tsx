'use client';
// PM-04 도안 업로드 Sheet (REQ-101): 원본 업로드(.skp/.pdf/.dwg 50MB, 이중 검사) → 정보 입력 → create_design
import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { routes } from '@/shared/contracts/routes';
import type { AppError } from '@/shared/contracts/errors';
import { UploadField, UploadQueue, type UploadedFile } from '@/features/files';
import { createDesign } from '@/features/designs/server/actions';
import { designCreateSchema, type DesignCreateInput } from '@/features/designs/schema';
import { Plus } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { FormSheet } from '@/shared/ui/form-sheet';
import { FormField, firstFieldError, useFieldErrorText } from '@/shared/ui/form-parts';
import { useActionErrorText } from '@/shared/ui/action-error';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { NativeCheckbox } from '@/shared/ui/native-fields';

export function DesignCreateButton({
  projectId,
  companyId,
  companySlug,
}: {
  projectId: string;
  companyId: string;
  companySlug: string;
}) {
  const t = useTranslations('designs');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} data-ui-key="design-create-open">
        <Plus aria-hidden />
        {t('action.create')}
      </Button>
      <FormSheet
        open={open}
        onOpenChange={setOpen}
        busy={busy}
        title={t('action.create')}
        uiKey="design-create-sheet"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              {tc('action.cancel')}
            </Button>
            <Button
              type="submit"
              form="design-create-form"
              pending={busy}
              data-ui-key="design-create-submit"
            >
              {tc('action.save')}
            </Button>
          </>
        }
      >
        <DesignCreateForm
          projectId={projectId}
          companyId={companyId}
          companySlug={companySlug}
          onDone={() => setOpen(false)}
          onBusyChange={setBusy}
        />
      </FormSheet>
    </>
  );
}

function DesignCreateForm({
  projectId,
  companyId,
  companySlug,
  onDone,
  onBusyChange,
}: {
  projectId: string;
  companyId: string;
  companySlug: string;
  onDone: () => void;
  /** 업로드·저장 중 → Sheet 닫힘 방지·저장 버튼 비활성 */
  onBusyChange: (busy: boolean) => void;
}) {
  const t = useTranslations('designs');
  const tc = useTranslations('common');
  const fieldText = useFieldErrorText();
  const actionText = useActionErrorText();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [serverError, setServerError] = useState<AppError | null>(null);
  const form = useForm<DesignCreateInput>({
    resolver: zodResolver(designCreateSchema),
    defaultValues: { projectId, title: '', description: '', note: '', isPublic: false, fileId: '' },
  });
  const { register, handleSubmit, setValue, formState } = form;

  const onUploaded = useCallback(
    (f: UploadedFile) => {
      setFile(f);
      setValue('fileId', f.fileId, { shouldValidate: true });
      if (!form.getValues('title')) setValue('title', f.name.replace(/\.[^.]+$/, '').slice(0, 120));
    },
    [form, setValue],
  );

  const submit = handleSubmit((values) =>
    start(async () => {
      setServerError(null);
      const res = await createDesign(values);
      if (!res.ok) {
        setServerError(res.error);
        toast.error(actionText(res.error));
        return;
      }
      toast.success(t('toast.created'));
      onDone();
      router.push(routes.app.design(companySlug, projectId, res.data.id));
    }),
  );

  const fieldErr = (name: keyof DesignCreateInput) => {
    const msg = formState.errors[name]?.message ?? firstFieldError(serverError, name);
    return msg ? fieldText(msg) : undefined;
  };
  // 업로드·저장 중에는 Sheet 를 닫거나 다시 제출할 수 없다 (footer 버튼은 Sheet 가 그린다)
  useEffect(() => onBusyChange(pending || uploading), [pending, uploading, onBusyChange]);

  return (
    <form
      id="design-create-form"
      onSubmit={(e) => {
        if (pending || uploading) {
          e.preventDefault();
          return;
        }
        void submit(e);
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      <UploadField
        label={t('field.original')}
        error={fieldErr('fileId')}
        fileName={file?.name}
        required
      >
        <UploadQueue
          target={{ kind: 'design_original', projectId, companyId }}
          onUploaded={onUploaded}
          onBusyChange={setUploading}
          uiKey="design-create-file"
        />
      </UploadField>
      <FormField label={t('field.title')} error={fieldErr('title')} required>
        <Input {...register('title')} maxLength={120} />
      </FormField>
      <FormField label={t('field.description')} error={fieldErr('description')}>
        <Textarea {...register('description')} rows={3} maxLength={2000} />
      </FormField>
      <FormField label={t('field.note')} error={fieldErr('note')}>
        <Input {...register('note')} maxLength={500} />
      </FormField>
      <div className="flex flex-col gap-1">
        <NativeCheckbox
          {...register('isPublic')}
          label={tc('visibility.label')}
          data-ui-key="design-create-public"
        />
        <p className="text-meta text-muted-foreground ps-6">{t('publish.hint')}</p>
      </div>
    </form>
  );
}

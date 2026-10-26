'use client';
// PM-04 도안 업로드 Sheet (REQ-101·D-20·D-21): 원본 업로드(업계 형식 16종 50MB, 이중 검사) → 정보 입력 → create_design
// D-21: 원본이 이미지(PNG·JPG·WebP)면 같은 이미지를 첫 비교 이미지로도 등록한다 — 이미지 1장만으로 도안을 시작
import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { routes } from '@/shared/contracts/routes';
import type { AppError } from '@/shared/contracts/errors';
import { UploadField, UploadQueue, uploadFile, type UploadedFile } from '@/features/files';
import { FILE_RULES } from '@/shared/contracts/domain';
import { addDesignPreview, createDesign } from '@/features/designs/server/actions';
import { designCreateSchema, type DesignCreateInput } from '@/features/designs/schema';
import { Plus } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { FormSheet } from '@/shared/ui/form-sheet';
import { FormField, firstFieldError, useFieldErrorText } from '@/shared/ui/form-parts';
import { useActionErrorText } from '@/shared/ui/action-error';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { NativeCheckbox } from '@/shared/ui/native-fields';
import { DesignSpaceSelect, spaceValue } from '@/features/designs/components/DesignSpaceControls';

/** D-21: 비교 이미지 규격(PNG·JPG·WebP, 20MB)에 맞는 이미지 원본인가 */
function isPreviewableImage(f: File): boolean {
  const dot = f.name.lastIndexOf('.');
  const ext = dot >= 0 ? f.name.slice(dot).toLowerCase() : '';
  const rule = FILE_RULES.design_preview;
  return rule.exts.includes(ext) && f.size > 0 && f.size <= rule.maxBytes;
}

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
    defaultValues: {
      projectId,
      title: '',
      description: '',
      note: '',
      isPublic: false,
      fileId: '',
      space: null,
    },
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
      // D-21: 이미지 원본은 첫 비교 이미지로도 등록 (실패해도 도안은 이미 만들어졌다 — 상세에서 다시 추가)
      const src = file?.source;
      if (src && isPreviewableImage(src)) {
        const up = await uploadFile(src, { kind: 'design_preview', projectId, companyId });
        const added = up.ok
          ? await addDesignPreview({
              projectId,
              designId: res.data.id,
              id: crypto.randomUUID(),
              fileId: up.file.fileId,
              label: values.title.slice(0, 80),
              designVersionId: null,
              pdfPage: null,
            })
          : null;
        if (!added?.ok) toast.warning(t('toast.previewAutoFailed'));
      }
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
        hint={t('field.originalHint')}
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
      <FormField label={t('field.space')} hint={t('field.spaceHint')}>
        <DesignSpaceSelect {...register('space', { setValueAs: spaceValue })} />
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

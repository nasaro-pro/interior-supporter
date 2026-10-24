'use client';
// PM-14 비교 이미지 등록 (REQ-104): 이미지 직접 업로드 또는 PDF 선택 페이지 → PNG(긴 변 2400px)
import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ImagePlus } from 'lucide-react';
import { routes } from '@/shared/contracts/routes';
import { Button } from '@/shared/ui/button';
import { FormSheet } from '@/shared/ui/form-sheet';
import { FormField } from '@/shared/ui/form-parts';
import { useActionErrorText } from '@/shared/ui/action-error';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/native-fields';
import { UploadField, UploadQueue, uploadFile, type UploadedFile } from '@/features/files';
import { addDesignPreview } from '@/features/designs/server/actions';
import { fetchFileBytes, PdfError, renderPdfPageToPng } from '@/features/designs/lib/pdf';

export interface PreviewVersionOption {
  id: string;
  versionNo: number;
  fileId: string | null;
  isPdf: boolean;
}

export function PreviewAddButton({
  projectId,
  companyId,
  designId,
  versions,
}: {
  projectId: string;
  companyId: string;
  designId: string;
  versions: PreviewVersionOption[];
}) {
  const t = useTranslations('designs');
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'image' | 'pdf'>('image');
  const [busy, setBusy] = useState(false);
  const pdfVersions = versions.filter((v) => v.isPdf && v.fileId);
  const tab = (key: 'image' | 'pdf', label: string, disabled = false) => (
    <Button
      role="tab"
      aria-selected={mode === key}
      variant={mode === key ? 'secondary' : 'ghost'}
      size="sm"
      disabled={disabled || busy}
      onClick={() => setMode(key)}
      data-ui-key={`design-preview-mode-${key}`}
    >
      {label}
    </Button>
  );
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        data-ui-key="design-preview-open"
      >
        <ImagePlus aria-hidden />
        {t('action.addPreview')}
      </Button>
      <FormSheet
        open={open}
        onOpenChange={setOpen}
        busy={busy}
        title={t('action.addPreview')}
        uiKey="design-preview-sheet"
      >
        <div className="flex flex-col gap-4">
          <div role="tablist" aria-label={t('action.addPreview')} className="flex flex-wrap gap-2">
            {tab('image', t('preview.modeImage'))}
            {tab('pdf', t('action.extractPdf'), pdfVersions.length === 0)}
          </div>
          {mode === 'image' ? (
            <ImagePreviewForm
              projectId={projectId}
              companyId={companyId}
              designId={designId}
              versions={versions}
              onDone={() => setOpen(false)}
              onBusyChange={setBusy}
            />
          ) : (
            <PdfPreviewForm
              projectId={projectId}
              companyId={companyId}
              designId={designId}
              versions={pdfVersions}
              onDone={() => setOpen(false)}
              onBusyChange={setBusy}
            />
          )}
        </div>
      </FormSheet>
    </>
  );
}

function VersionSelect({
  versions,
  value,
  onChange,
  allowWhole,
  ...aria
}: {
  versions: PreviewVersionOption[];
  value: string;
  onChange: (v: string) => void;
  allowWhole: boolean;
  /** FormField 가 주입하는 id·aria-* */
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}) {
  const t = useTranslations('designs');
  return (
    <NativeSelect {...aria} value={value} onChange={(e) => onChange(e.target.value)}>
      {allowWhole ? <option value="">{t('field.wholeDesign')}</option> : null}
      {versions.map((v) => (
        <option key={v.id} value={v.id}>
          {t('field.version', { no: v.versionNo })}
        </option>
      ))}
    </NativeSelect>
  );
}

type FormProps = {
  projectId: string;
  companyId: string;
  designId: string;
  versions: PreviewVersionOption[];
  onDone: () => void;
  /** 업로드·저장 중 → Sheet 닫힘·탭 전환 막기 */
  onBusyChange: (busy: boolean) => void;
};

function ImagePreviewForm({
  projectId,
  companyId,
  designId,
  versions,
  onDone,
  onBusyChange,
}: FormProps) {
  const t = useTranslations('designs');
  const tc = useTranslations('common');
  const actionText = useActionErrorText();
  const router = useRouter();
  const [id] = useState(() => crypto.randomUUID());
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [label, setLabel] = useState('');
  const [versionId, setVersionId] = useState(versions[0]?.id ?? '');
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();

  const onUploaded = useCallback((f: UploadedFile) => {
    setFile(f);
    setLabel((prev) => prev || f.name.replace(/\.[^.]+$/, '').slice(0, 80));
  }, []);
  useEffect(() => onBusyChange(pending || uploading), [pending, uploading, onBusyChange]);

  const submit = () =>
    start(async () => {
      if (!file) return;
      const res = await addDesignPreview({
        projectId,
        designId,
        id,
        fileId: file.fileId,
        label,
        designVersionId: versionId || null,
        pdfPage: null,
      });
      if (!res.ok) {
        toast.error(actionText(res.error));
        return;
      }
      toast.success(t('toast.previewAdded'));
      onDone();
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <UploadField label={t('preview.modeImage')} fileName={file?.name} required>
        <UploadQueue
          target={{ kind: 'design_preview', projectId, companyId }}
          onUploaded={onUploaded}
          onBusyChange={setUploading}
          uiKey="design-preview-file"
        />
      </UploadField>
      <FormField label={t('field.previewLabel')} required>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
      </FormField>
      <FormField label={t('field.linkedVersion')}>
        <VersionSelect versions={versions} value={versionId} onChange={setVersionId} allowWhole />
      </FormField>
      <div className="flex justify-end">
        <Button
          onClick={submit}
          disabled={uploading || !file || !label.trim()}
          pending={pending}
          data-ui-key="design-preview-submit"
        >
          {tc('action.save')}
        </Button>
      </div>
    </div>
  );
}

function PdfPreviewForm({
  projectId,
  companyId,
  designId,
  versions,
  onDone,
  onBusyChange,
}: FormProps) {
  const t = useTranslations('designs');
  const tf = useTranslations('files');
  const actionText = useActionErrorText();
  const router = useRouter();
  const [id] = useState(() => crypto.randomUUID());
  const [versionId, setVersionId] = useState(versions[0]?.id ?? '');
  const [page, setPage] = useState(1);
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const version = versions.find((v) => v.id === versionId);
  useEffect(() => onBusyChange(pending), [pending, onBusyChange]);

  const run = () =>
    start(async () => {
      if (!version?.fileId) return;
      setFailed(null);
      setStatus(t('pdf.extracting', { page }));
      let png: Blob;
      try {
        const bytes = await fetchFileBytes(routes.file(version.fileId));
        png = await renderPdfPageToPng(bytes, page);
      } catch (e) {
        setStatus(null);
        const reason = e instanceof PdfError ? e.reason : 'failed';
        setFailed(
          reason === 'password'
            ? t('pdf.password')
            : reason === 'page'
              ? t('pdf.pageOutOfRange')
              : t('pdf.extractFailed'),
        );
        return;
      }
      const file = new File([png], `design-v${version.versionNo}-p${page}.png`, {
        type: 'image/png',
      });
      const up = await uploadFile(file, { kind: 'design_preview', projectId, companyId });
      if (!up.ok) {
        setStatus(null);
        setFailed(
          'code' in up
            ? actionText({ code: up.code, ref: up.ref })
            : 'rejectReason' in up
              ? tf(`rejectReason.${up.rejectReason}`)
              : t('pdf.extractFailed'),
        );
        return;
      }
      const res = await addDesignPreview({
        projectId,
        designId,
        id,
        fileId: up.file.fileId,
        label: label.trim() || t('field.pdfPage', { page }),
        designVersionId: version.id,
        pdfPage: page,
      });
      setStatus(null);
      if (!res.ok) {
        setFailed(actionText(res.error));
        return;
      }
      toast.success(t('toast.previewAdded'));
      onDone();
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <FormField label={t('field.linkedVersion')}>
        <VersionSelect
          versions={versions}
          value={versionId}
          onChange={setVersionId}
          allowWhole={false}
        />
      </FormField>
      <FormField
        label={t('field.pageNumber')}
        error={failed === t('pdf.pageOutOfRange') ? failed : undefined}
      >
        <Input
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={page}
          onChange={(e) => setPage(Math.max(1, Math.trunc(Number(e.target.value) || 1)))}
        />
      </FormField>
      <FormField label={t('field.previewLabel')}>
        <Input
          value={label}
          placeholder={t('field.pdfPage', { page })}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={80}
        />
      </FormField>
      {status ? (
        <p role="status" className="text-muted-foreground text-sm">
          {status}
        </p>
      ) : null}
      {failed && failed !== t('pdf.pageOutOfRange') ? (
        <p role="alert" className="text-destructive text-sm">
          {failed}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button
          onClick={run}
          disabled={!version}
          pending={pending}
          data-ui-key="design-preview-extract"
        >
          {t('action.extractPdf')}
        </Button>
      </div>
    </div>
  );
}

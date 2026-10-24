'use client';
// PM-05 / PM-15 자재 등록·수정 Sheet (REQ-111) — 이미지 업로드, 확정 상태면 핵심 필드 변경 경고 (TASK-102)
// 표준 FormSheet(base-ui Dialog: 포커스 가두기·스크롤 잠금·Esc) · FormField(aria-invalid·describedby·role=alert)
import { useCallback, useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Pencil, Plus, X } from 'lucide-react';
import { MATERIAL_SPACES, type ConfirmState } from '@/shared/contracts/domain';
import type { AppError } from '@/shared/contracts/errors';
import { routes } from '@/shared/contracts/routes';
import { Button } from '@/shared/ui/button';
import { FormSheet } from '@/shared/ui/form-sheet';
import { FormField, firstFieldError, useFieldErrorText } from '@/shared/ui/form-parts';
import { ActionError, useActionErrorText } from '@/shared/ui/action-error';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { NativeCheckbox, NativeSelect } from '@/shared/ui/native-fields';
import { Notice } from '@/shared/ui/notice';
import { UploadField, UploadQueue, type UploadedFile } from '@/features/files';
import { createMaterial, updateMaterial } from '@/features/materials/server/actions';
import {
  coreFieldsChanged,
  materialFieldsSchema,
  type MaterialFields,
} from '@/features/materials/schema';

type FormText = Record<
  'name' | 'category' | 'spec' | 'quantity' | 'unit' | 'unitPrice' | 'locationNote' | 'description',
  string
> & { space: MaterialFields['space']; imageFileId: string | null };

const toText = (m?: MaterialFields): FormText => ({
  name: m?.name ?? '',
  category: m?.category ?? '',
  space: m?.space ?? 'other',
  spec: m?.spec ?? '',
  quantity: m?.quantity === null || m?.quantity === undefined ? '' : String(m.quantity),
  unit: m?.unit ?? '',
  unitPrice: m?.unitPrice === null || m?.unitPrice === undefined ? '' : String(m.unitPrice),
  imageFileId: m?.imageFileId ?? null,
  locationNote: m?.locationNote ?? '',
  description: m?.description ?? '',
});

const toNumber = (s: string) => {
  const v = s.replaceAll(',', '').trim();
  return v === '' ? null : Number(v);
};

export function MaterialFormSheet({
  mode,
  projectId,
  companyId,
  companySlug,
  categories,
  initial,
  baseVersion,
  confirmState,
}: {
  mode: 'create' | 'edit';
  projectId: string;
  companyId: string;
  companySlug: string;
  categories: string[];
  initial?: MaterialFields & { id: string };
  baseVersion?: number;
  confirmState?: ConfirmState;
}) {
  const t = useTranslations('materials');
  const tc = useTranslations('common');
  const fieldText = useFieldErrorText();
  const actionText = useActionErrorText();
  const router = useRouter();
  const listId = useId();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [id, setId] = useState(() => initial?.id ?? crypto.randomUUID());
  const [form, setForm] = useState<FormText>(() => toText(initial));
  const [isPublic, setIsPublic] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [local, setLocal] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const busy = pending || uploading;

  const set = <K extends keyof FormText>(k: K, v: FormText[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const onUploaded = useCallback(
    (f: UploadedFile) => setForm((prev) => ({ ...prev, imageFileId: f.fileId })),
    [],
  );

  const openSheet = () => {
    // 폼을 열 때 id 생성 (POL-038) · 수정은 현재 값으로 초기화
    if (mode === 'create') setId(crypto.randomUUID());
    setForm(toText(initial));
    setIsPublic(false);
    setError(null);
    setLocal({});
    setOpen(true);
  };

  const fields = (): MaterialFields => ({
    name: form.name,
    category: form.category,
    space: form.space,
    spec: form.spec,
    quantity: toNumber(form.quantity),
    unit: form.unit,
    unitPrice: toNumber(form.unitPrice),
    imageFileId: form.imageFileId,
    locationNote: form.locationNote,
    description: form.description,
  });

  const submit = () =>
    start(async () => {
      const values = fields();
      const check = materialFieldsSchema.safeParse(values);
      if (!check.success) {
        const next: Record<string, string> = {};
        for (const issue of check.error.issues) {
          const k = String(issue.path[0]);
          next[k] ??= issue.message;
        }
        setLocal(next);
        return;
      }
      setLocal({});
      setError(null);
      if (mode === 'create') {
        const res = await createMaterial({ ...check.data, projectId, id, isPublic });
        if (!res.ok) {
          setError(res.error);
          toast.error(actionText(res.error));
          return;
        }
        toast.success(t('toast.created'));
        setOpen(false);
        router.push(routes.app.material(companySlug, projectId, res.data.id));
        return;
      }
      const res = await updateMaterial({ ...check.data, projectId, id, baseVersion });
      if (!res.ok) {
        setError(res.error);
        if (res.error.code !== 'VERSION_CONFLICT') toast.error(actionText(res.error));
        return;
      }
      toast.success(res.data.reconfirm ? t('toast.savedReconfirm') : t('toast.updated'));
      setOpen(false);
      router.refresh();
    });

  const fe = (k: keyof FormText) => {
    const msg = local[k] ?? firstFieldError(error, k);
    return msg ? fieldText(msg) : undefined;
  };
  const coreChanging =
    mode === 'edit' &&
    confirmState === 'confirmed' &&
    initial &&
    coreFieldsChanged(initial, fields());
  const title = mode === 'create' ? t('action.create') : tc('action.edit');

  return (
    <>
      {mode === 'create' ? (
        <Button onClick={openSheet} data-ui-key="material-create-open">
          <Plus aria-hidden />
          {title}
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={openSheet} data-ui-key="material-edit-open">
          <Pencil aria-hidden />
          {title}
        </Button>
      )}
      <FormSheet
        open={open}
        onOpenChange={(o) => (o ? setOpen(true) : setOpen(false))}
        busy={busy}
        title={title}
        uiKey={mode === 'create' ? 'material-create-sheet' : 'material-edit-sheet'}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              {tc('action.cancel')}
            </Button>
            <Button
              type="submit"
              form={formId}
              disabled={uploading}
              pending={pending}
              data-ui-key={mode === 'create' ? 'material-form-submit' : 'material-edit-submit'}
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
          {error?.code === 'VERSION_CONFLICT' ? <ActionError error={error} /> : null}
          {mode === 'edit' && confirmState === 'confirmed' ? (
            <Notice
              tone={coreChanging ? 'attention' : 'info'}
              role={coreChanging ? 'alert' : undefined}
            >
              {t('form.coreChangeWarning')}
            </Notice>
          ) : null}
          <FormField label={t('field.name')} error={fe('name')} required>
            <Input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              maxLength={120}
              data-ui-key="material-form-name"
            />
          </FormField>
          <FormField
            label={t('field.category')}
            hint={t('form.categoryHint')}
            error={fe('category')}
          >
            <Input
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              list={listId}
              maxLength={40}
              data-ui-key="material-form-category"
            />
          </FormField>
          <datalist id={listId}>
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <FormField label={t('field.space')} error={fe('space')}>
            <NativeSelect
              value={form.space}
              onChange={(e) => set('space', e.target.value as FormText['space'])}
              data-ui-key="material-form-space"
            >
              {MATERIAL_SPACES.map((s) => (
                <option key={s} value={s}>
                  {t(`space.${s}`)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label={t('field.spec')} error={fe('spec')}>
            <Textarea
              value={form.spec}
              onChange={(e) => set('spec', e.target.value)}
              rows={3}
              maxLength={1000}
              data-ui-key="material-form-spec"
            />
          </FormField>
          <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
            <FormField label={t('field.quantity')} error={fe('quantity')}>
              <Input
                inputMode="decimal"
                value={form.quantity}
                onChange={(e) => set('quantity', e.target.value)}
                data-ui-key="material-form-quantity"
              />
            </FormField>
            <FormField label={t('field.unit')} error={fe('unit')}>
              <Input
                value={form.unit}
                onChange={(e) => set('unit', e.target.value)}
                maxLength={20}
                data-ui-key="material-form-unit"
              />
            </FormField>
          </div>
          <FormField
            label={t('field.unitPrice')}
            hint={t('form.priceHint')}
            error={fe('unitPrice')}
          >
            <Input
              inputMode="numeric"
              value={form.unitPrice}
              onChange={(e) => set('unitPrice', e.target.value)}
              data-ui-key="material-form-unit-price"
            />
          </FormField>
          <UploadField label={t('field.image')} error={fe('imageFileId')}>
            <div className="flex flex-col gap-2">
              {form.imageFileId ? (
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 권한 재검사 라우트(302) */}
                  <img
                    src={routes.file(form.imageFileId)}
                    alt=""
                    className="h-16 w-16 rounded-sm border object-cover"
                  />
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => set('imageFileId', null)}
                    data-ui-key="material-image-clear"
                  >
                    <X aria-hidden />
                    {tc('action.clear')}
                  </Button>
                </div>
              ) : null}
              <UploadQueue
                target={{ kind: 'material_image', projectId, companyId }}
                onUploaded={onUploaded}
                onBusyChange={setUploading}
                uiKey="material-image-upload"
              />
            </div>
          </UploadField>
          <FormField label={t('field.locationNote')} error={fe('locationNote')}>
            <Input
              value={form.locationNote}
              onChange={(e) => set('locationNote', e.target.value)}
              maxLength={200}
              data-ui-key="material-form-location-note"
            />
          </FormField>
          <FormField label={t('field.description')} error={fe('description')}>
            <Textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </FormField>
          {mode === 'create' ? (
            <NativeCheckbox
              label={tc('visibility.label')}
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              data-ui-key="material-create-public"
            />
          ) : null}
        </form>
      </FormSheet>
    </>
  );
}

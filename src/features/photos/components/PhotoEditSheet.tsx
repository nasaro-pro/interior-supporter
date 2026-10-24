'use client';
// 사진 정보 수정 Sheet (?mode=edit) — 공정·촬영일·설명 (REQ-213 편집자 / REQ-222 시공팀 본인)
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { PHOTO_PHASES, type PhotoPhase } from '@/shared/contracts/domain';
import type { AppError } from '@/shared/contracts/errors';
import { useSearchParamState } from '@/shared/hooks/use-search-param-state';
import { ActionError } from '@/shared/ui/action-error';
import { Button } from '@/shared/ui/button';
import { FormField } from '@/shared/ui/form-parts';
import { FormSheet } from '@/shared/ui/form-sheet';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/native-fields';
import { Textarea } from '@/shared/ui/textarea';
import { updatePhoto } from '../server/actions';
import { PHOTO_LIMITS, photoUpdateSchema } from '../schema';
import type { PhotoItem } from '../types';

const formSchema = photoUpdateSchema.pick({ phase: true, capturedOn: true, description: true });
type FormValues = { phase: PhotoPhase; capturedOn: string | null; description: string };

export function PhotoEditSheet({ photo }: { photo: PhotoItem }) {
  const t = useTranslations();
  const router = useRouter();
  const [mode, setMode] = useSearchParamState('mode');
  const [serverError, setServerError] = useState<AppError | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      phase: photo.phase,
      capturedOn: photo.capturedOn,
      description: photo.description,
    },
  });
  const { errors } = form.formState;
  const descError = errors.description?.message
    ? t(`errors.${errors.description.message}`, { max: PHOTO_LIMITS.description })
    : undefined;
  const dateError = errors.capturedOn?.message
    ? t(`errors.${errors.capturedOn.message}`)
    : undefined;

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await updatePhoto({
        projectId: photo.projectId,
        photoId: photo.id,
        baseVersion: photo.version,
        ...values,
      });
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      setServerError(null);
      toast.success(t('photos.toast.saved'));
      setMode(null);
      router.refresh();
    }),
  );

  return (
    <>
      <Button variant="outline" onClick={() => setMode('edit')} data-ui-key="photo-edit-open">
        <Pencil aria-hidden />
        {t('photos.action.edit')}
      </Button>
      <FormSheet
        open={mode === 'edit'}
        onOpenChange={(open) => setMode(open ? 'edit' : null)}
        busy={pending}
        uiKey="photo-edit-sheet"
        title={t('photos.form.editTitle')}
        footer={
          <>
            <Button variant="outline" onClick={() => setMode(null)} disabled={pending}>
              {t('common.action.cancel')}
            </Button>
            <Button
              type="submit"
              form="photo-edit-form"
              pending={pending}
              data-ui-key="photo-form-submit"
            >
              {t('common.action.save')}
            </Button>
          </>
        }
      >
        <form id="photo-edit-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <ActionError error={serverError} />
          <FormField id="photo-edit-phase" label={t('photos.field.phase')}>
            <NativeSelect {...form.register('phase')}>
              {PHOTO_PHASES.map((p) => (
                <option key={p} value={p}>
                  {t(`photos.phase.${p}`)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="photo-edit-date" label={t('photos.field.capturedOn')} error={dateError}>
            <Input
              type="date"
              {...form.register('capturedOn', { setValueAs: (v: string) => (v ? v : null) })}
            />
          </FormField>
          <FormField id="photo-edit-desc" label={t('photos.field.description')} error={descError}>
            <Textarea
              rows={4}
              maxLength={PHOTO_LIMITS.description}
              {...form.register('description')}
            />
          </FormField>
        </form>
      </FormSheet>
    </>
  );
}

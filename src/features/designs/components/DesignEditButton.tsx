'use client';
// PM-14 도안 정보 수정 (REQ-106) — 낙관적 잠금, 충돌 시 입력 보존 + 최신 내용 안내
// B-12: useForm({ values }) 는 props 가 바뀔 때마다(=router.refresh) 입력을 덮어써서 충돌 후 입력이 사라졌다.
//       → defaultValues + 시트를 열 때만 reset, 새로고침으로 바뀐 baseVersion 만 setValue, 그때 충돌 안내를 지운다.
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { AppError } from '@/shared/contracts/errors';
import { updateDesign } from '@/features/designs/server/actions';
import { designUpdateSchema, type DesignUpdateInput } from '@/features/designs/schema';
import { Pencil } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { FormSheet } from '@/shared/ui/form-sheet';
import { FormField, firstFieldError, useFieldErrorText } from '@/shared/ui/form-parts';
import { ActionError, useActionErrorText } from '@/shared/ui/action-error';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';

export function DesignEditButton({
  projectId,
  id,
  baseVersion,
  title,
  description,
}: {
  projectId: string;
  id: string;
  baseVersion: number;
  title: string;
  description: string;
}) {
  const t = useTranslations('designs');
  const tc = useTranslations('common');
  const fieldText = useFieldErrorText();
  const actionText = useActionErrorText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [serverError, setServerError] = useState<AppError | null>(null);
  const { register, handleSubmit, formState, reset, setValue } = useForm<DesignUpdateInput>({
    resolver: zodResolver(designUpdateSchema),
    defaultValues: { projectId, id, baseVersion, title, description },
  });

  const openSheet = () => {
    // 열 때만 서버 값으로 채운다 (편집 중 새로고침은 입력을 건드리지 않는다)
    reset({ projectId, id, baseVersion, title, description });
    setServerError(null);
    setOpen(true);
  };

  // '최신 내용 불러오기' 후 새 버전이 오면 잠금 기준만 바꾸고 충돌 안내를 지운다 (사용자 입력 유지)
  // (렌더 중 이전 값 비교 — effect 안 setState 금지 규칙, react.dev "you might not need an effect")
  const [seenVersion, setSeenVersion] = useState(baseVersion);
  if (seenVersion !== baseVersion) {
    setSeenVersion(baseVersion);
    if (serverError?.code === 'VERSION_CONFLICT') setServerError(null);
  }
  useEffect(() => {
    setValue('baseVersion', baseVersion);
  }, [baseVersion, setValue]);

  const submit = handleSubmit((values) =>
    start(async () => {
      setServerError(null);
      // 잠금 기준은 항상 최신 props (폼 값이 늦게 반영돼도 안전)
      const res = await updateDesign({ ...values, baseVersion });
      if (!res.ok) {
        setServerError(res.error);
        if (res.error.code !== 'VERSION_CONFLICT') toast.error(actionText(res.error));
        return;
      }
      toast.success(tc('toast.saved'));
      setOpen(false);
      router.refresh();
    }),
  );

  const fieldErr = (name: 'title' | 'description') => {
    const msg = formState.errors[name]?.message ?? firstFieldError(serverError, name);
    return msg ? fieldText(msg) : undefined;
  };
  const close = () => {
    setOpen(false);
    setServerError(null);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={openSheet} data-ui-key="design-edit-open">
        <Pencil aria-hidden />
        {tc('action.edit')}
      </Button>
      <FormSheet
        open={open}
        onOpenChange={(o) => (o ? setOpen(true) : close())}
        busy={pending}
        title={tc('action.edit')}
        uiKey="design-edit-sheet"
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={pending}>
              {tc('action.cancel')}
            </Button>
            <Button
              type="submit"
              form="design-edit-form"
              pending={pending}
              data-ui-key="design-edit-submit"
            >
              {tc('action.save')}
            </Button>
          </>
        }
      >
        <form id="design-edit-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {serverError?.code === 'VERSION_CONFLICT' ? <ActionError error={serverError} /> : null}
          <FormField label={t('field.title')} error={fieldErr('title')} required>
            <Input {...register('title')} maxLength={120} />
          </FormField>
          <FormField label={t('field.description')} error={fieldErr('description')}>
            <Textarea {...register('description')} rows={4} maxLength={2000} />
          </FormField>
        </form>
      </FormSheet>
    </>
  );
}

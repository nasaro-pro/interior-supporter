'use client';
// 요청 작성 Sheet CL-06 (?mode=new) — REQ-201, POL-038(열 때 만든 id 로 중복 방지)
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import type { AppError } from '@/shared/contracts/errors';
import { routes } from '@/shared/contracts/routes';
import { useSearchParamState } from '@/shared/hooks/use-search-param-state';
import { ActionError } from '@/shared/ui/action-error';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { FormField } from '@/shared/ui/form-parts';
import { FormSheet } from '@/shared/ui/form-sheet';
import { Textarea } from '@/shared/ui/textarea';
import { createRequest } from '../server/actions';
import { REQUEST_LIMITS, requestEntrySchema } from '../schema';

// D-33 · CU-06: 제목 입력 없음 — 서버가 본문 앞부분으로 제목을 만든다
const formSchema = requestEntrySchema.pick({ body: true });
type FormValues = { body: string };

export function RequestCreateSheet({ projectId }: { projectId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [mode, setMode] = useSearchParamState('mode');
  const open = mode === 'new';
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [confirming, setConfirming] = useState(false);
  const [serverError, setServerError] = useState<AppError | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { body: '' },
  });
  const { errors } = form.formState;

  const errorText = (key: string | undefined, max: number) =>
    key ? t(`errors.${key}`, { max }) : undefined;

  const close = () => {
    setMode(null);
    setConfirming(false);
    setServerError(null);
  };

  const submit = form.handleSubmit(() => setConfirming(true));

  const confirm = () => {
    const values = form.getValues();
    startTransition(async () => {
      const res = await createRequest({ id: clientId, projectId, ...values });
      setConfirming(false);
      if (!res.ok) {
        setServerError(res.error);
        for (const [field, keys] of Object.entries(res.error.fieldErrors ?? {})) {
          if (field === 'body') form.setError(field, { message: keys[0] });
        }
        return; // 입력 보존 (공통 AC ③)
      }
      toast.success(t('requests.customer.created'));
      form.reset();
      setClientId(crypto.randomUUID());
      router.push(routes.portal.request(projectId, res.data.id));
    });
  };

  return (
    <>
      <Button onClick={() => setMode('new')} data-ui-key="request-create-open">
        <Plus aria-hidden />
        {t('requests.customer.create')}
      </Button>
      <FormSheet
        open={open}
        onOpenChange={(next) => (next ? setMode('new') : close())}
        busy={pending}
        uiKey="request-create-sheet"
        title={t('requests.customer.create')}
        description={t('requests.customer.immutableHint')}
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={pending}>
              {t('common.action.cancel')}
            </Button>
            <Button
              type="submit"
              form="request-create-form"
              pending={pending}
              data-ui-key="request-form-submit"
            >
              {t('requests.customer.submit')}
            </Button>
          </>
        }
      >
        <form id="request-create-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <ActionError error={serverError} />
          <FormField
            id="request-body"
            label={t('requests.customer.body')}
            required
            requiredLabel={t('common.field.required')}
            error={errorText(errors.body?.message, REQUEST_LIMITS.body)}
          >
            <Textarea rows={8} maxLength={REQUEST_LIMITS.body} {...form.register('body')} />
          </FormField>
        </form>
      </FormSheet>
      {/* 제출 확인 — 위험 동작이 아니므로 destructive=false. 확인 버튼 data-ui-key: request-submit-confirm */}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        uiKey="request-submit"
        destructive={false}
        title={t('requests.customer.submitTitle')}
        body={t('requests.customer.submitBody')}
        confirmLabel={t('requests.customer.submit')}
        onConfirm={confirm}
        pending={pending}
      />
    </>
  );
}

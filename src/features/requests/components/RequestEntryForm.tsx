'use client';
// 정정(CL-16, 원 작성자) · 답변(PM-16, 편집자) 추가 폼 — 추가 전용, 수정·삭제 없음 (REQ-203, REQ-204)
import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { AppError } from '@/shared/contracts/errors';
import { ActionError } from '@/shared/ui/action-error';
import { Button } from '@/shared/ui/button';
import { FormField } from '@/shared/ui/form-parts';
import { Textarea } from '@/shared/ui/textarea';
import { addRequestCorrection, addRequestReply } from '../server/actions';
import { REQUEST_LIMITS } from '../schema';

export function RequestEntryForm({
  kind,
  projectId,
  requestId,
}: {
  kind: 'correction' | 'reply';
  projectId: string;
  requestId: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [entryId, setEntryId] = useState(() => crypto.randomUUID());
  const [body, setBody] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<AppError | null>(null);
  const [pending, startTransition] = useTransition();
  const id = `request-${kind}-body`;
  const hint =
    kind === 'reply' ? t('requests.reply.hint') : t('requests.detail.correctionNoStatus');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      setFieldError(t('errors.field.required'));
      return;
    }
    setFieldError(undefined);
    startTransition(async () => {
      const action = kind === 'reply' ? addRequestReply : addRequestCorrection;
      const res = await action({ id: entryId, projectId, requestId, body: trimmed });
      if (!res.ok) {
        setServerError(res.error);
        const key = res.error.fieldErrors?.body?.[0];
        if (key) setFieldError(t(`errors.${key}`, { max: REQUEST_LIMITS.body }));
        return; // 입력 보존
      }
      setServerError(null);
      setBody('');
      setEntryId(crypto.randomUUID());
      toast.success(
        kind === 'reply' ? t('requests.toast.replyAdded') : t('requests.toast.correctionAdded'),
      );
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <ActionError error={serverError} />
      <FormField
        id={id}
        label={
          kind === 'reply' ? t('requests.form.replyLabel') : t('requests.form.correctionLabel')
        }
        hint={hint}
        error={fieldError}
      >
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={REQUEST_LIMITS.body}
          rows={4}
        />
      </FormField>
      <div className="flex justify-end">
        <Button
          type="submit"
          pending={pending}
          data-ui-key={kind === 'reply' ? 'request-reply-submit' : 'request-correction-submit'}
        >
          {kind === 'reply' ? t('requests.action.reply') : t('requests.action.addCorrection')}
        </Button>
      </div>
    </form>
  );
}

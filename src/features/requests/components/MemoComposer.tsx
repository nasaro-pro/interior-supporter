'use client';
// D-32 · D-33 메모 입력 — 고객: 이 항목에 새 메모 (제목 없음) · 편집자: 메모에 답변
// 추가 전용 (원문 수정 · 삭제 없음, POL-019). 실패해도 입력은 남긴다
import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import type { AppError } from '@/shared/contracts/errors';
import { ActionError } from '@/shared/ui/action-error';
import { Button } from '@/shared/ui/button';
import { Textarea } from '@/shared/ui/textarea';
import { addRequestReply, createRequest } from '../server/actions';
import { REQUEST_LIMITS, type RequestTargetType } from '../schema';

type Props =
  | { kind: 'memo'; projectId: string; targetType: RequestTargetType; targetId: string }
  | { kind: 'reply'; projectId: string; requestId: string };

export function MemoComposer(props: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [id, setId] = useState(() => crypto.randomUUID());
  const [body, setBody] = useState('');
  const [error, setError] = useState<AppError | null>(null);
  const [fieldError, setFieldError] = useState<string>();
  const [pending, start] = useTransition();
  const inputId =
    props.kind === 'memo' ? `memo-new-${props.targetId}` : `memo-reply-${props.requestId}`;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = body.trim();
    if (!text) {
      setFieldError(t('errors.field.required'));
      return;
    }
    setFieldError(undefined);
    start(async () => {
      const res =
        props.kind === 'memo'
          ? await createRequest({
              id,
              projectId: props.projectId,
              body: text,
              targetType: props.targetType,
              targetId: props.targetId,
            })
          : await addRequestReply({
              id,
              projectId: props.projectId,
              requestId: props.requestId,
              body: text,
            });
      if (!res.ok) {
        setError(res.error);
        const key = res.error.fieldErrors?.body?.[0];
        if (key) setFieldError(t(`errors.${key}`, { max: REQUEST_LIMITS.body }));
        return;
      }
      setError(null);
      setBody('');
      setId(crypto.randomUUID());
      toast.success(
        props.kind === 'memo' ? t('requests.memo.sent') : t('requests.toast.replyAdded'),
      );
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
      <ActionError error={error} />
      <label htmlFor={inputId} className="sr-only">
        {props.kind === 'memo' ? t('requests.memo.placeholder') : t('requests.form.replyLabel')}
      </label>
      <Textarea
        id={inputId}
        rows={props.kind === 'memo' ? 3 : 2}
        value={body}
        maxLength={REQUEST_LIMITS.body}
        placeholder={
          props.kind === 'memo'
            ? t('requests.memo.placeholder')
            : t('requests.memo.replyPlaceholder')
        }
        aria-invalid={fieldError ? true : undefined}
        aria-describedby={fieldError ? `${inputId}-error` : undefined}
        onChange={(e) => setBody(e.target.value)}
      />
      {fieldError ? (
        <p id={`${inputId}-error`} className="text-destructive text-meta">
          {fieldError}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          pending={pending}
          data-ui-key={props.kind === 'memo' ? 'item-memo-send' : 'item-memo-reply'}
        >
          <Send aria-hidden />
          {props.kind === 'memo' ? t('requests.memo.send') : t('requests.action.reply')}
        </Button>
      </div>
    </form>
  );
}

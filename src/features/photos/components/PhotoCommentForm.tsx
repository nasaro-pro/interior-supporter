'use client';
// D-34 · CU-07 사진 댓글 입력 — 고객: 새 댓글 / 디자이너: 그 고객 대화에 답글. 추가 전용
import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import type { AppError } from '@/shared/contracts/errors';
import { ActionError } from '@/shared/ui/action-error';
import { Button } from '@/shared/ui/button';
import { Textarea } from '@/shared/ui/textarea';
import { addPhotoComment } from '../server/actions';
import { PHOTO_COMMENT_LIMIT } from '../schema';

export function PhotoCommentForm({
  projectId,
  photoId,
  threadOwner = null,
}: {
  projectId: string;
  photoId: string;
  /** 디자이너 답글일 때 답할 고객 */
  threadOwner?: string | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [id, setId] = useState(() => crypto.randomUUID());
  const [body, setBody] = useState('');
  const [error, setError] = useState<AppError | null>(null);
  const [fieldError, setFieldError] = useState<string>();
  const [pending, start] = useTransition();
  const reply = threadOwner !== null;
  const inputId = `photo-comment-${threadOwner ?? 'new'}`;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = body.trim();
    if (!text) {
      setFieldError(t('errors.field.required'));
      return;
    }
    setFieldError(undefined);
    start(async () => {
      const res = await addPhotoComment({ id, projectId, photoId, body: text, threadOwner });
      if (!res.ok) {
        setError(res.error);
        const key = res.error.fieldErrors?.body?.[0];
        if (key) setFieldError(t(`errors.${key}`, { max: PHOTO_COMMENT_LIMIT }));
        return;
      }
      setError(null);
      setBody('');
      setId(crypto.randomUUID());
      toast.success(reply ? t('photos.comments.replied') : t('photos.comments.sent'));
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
      <ActionError error={error} />
      <label htmlFor={inputId} className="sr-only">
        {reply ? t('photos.comments.replyLabel') : t('photos.comments.label')}
      </label>
      <Textarea
        id={inputId}
        rows={2}
        value={body}
        maxLength={PHOTO_COMMENT_LIMIT}
        placeholder={
          reply ? t('photos.comments.replyPlaceholder') : t('photos.comments.placeholder')
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
          data-ui-key={reply ? 'photo-comment-reply' : 'photo-comment-send'}
        >
          <Send aria-hidden />
          {reply ? t('photos.comments.reply') : t('photos.comments.send')}
        </Button>
      </div>
    </form>
  );
}

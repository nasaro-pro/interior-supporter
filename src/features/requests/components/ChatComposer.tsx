'use client';
// 메모 대화창 입력줄 (2026-11 새 디자인) — 고객이 새 메모를 보낸다 (제목은 서버가 본문 앞부분으로, D-33)
//  · 메모 탭: 클립 버튼으로 도안 · 자재를 골라 연결할 수 있다 (targets)
//  · 도안 · 자재 옆 칸: 그 항목에 자동 연결 (fixedTarget) + 자주 쓰는 말 버튼 (chips)
// 추가 전용(원문 수정 · 삭제 없음, POL-019). 실패해도 입력은 남긴다. Ctrl/⌘+Enter 로도 보낸다
import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { FileImage, Package, Paperclip, Send, X } from 'lucide-react';
import type { AppError } from '@/shared/contracts/errors';
import { ActionError } from '@/shared/ui/action-error';
import { cn } from '@/shared/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { createRequest } from '../server/actions';
import { REQUEST_LIMITS, type RequestTargetType } from '../schema';

type Target = { type: RequestTargetType; id: string; label: string };

export function ChatComposer({
  projectId,
  targets = [],
  fixedTarget,
  chips = false,
}: {
  projectId: string;
  /** 연결할 수 있는 항목 (메모 탭) */
  targets?: Target[];
  /** 이 항목에 자동 연결 (도안 · 자재 옆 칸) */
  fixedTarget?: { type: RequestTargetType; id: string };
  /** 자주 쓰는 말 버튼 */
  chips?: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [id, setId] = useState(() => crypto.randomUUID());
  const [body, setBody] = useState('');
  const [picked, setPicked] = useState<Target | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [fieldError, setFieldError] = useState<string>();
  const [pending, start] = useTransition();
  const inputId = fixedTarget ? `chat-${fixedTarget.id}` : `chat-${projectId}`;
  const target = fixedTarget ?? (picked ? { type: picked.type, id: picked.id } : null);

  const send = () => {
    const text = body.trim();
    if (!text) {
      setFieldError(t('errors.field.required'));
      return;
    }
    setFieldError(undefined);
    start(async () => {
      const res = await createRequest({
        id,
        projectId,
        body: text,
        targetType: target?.type ?? null,
        targetId: target?.id ?? null,
      });
      if (!res.ok) {
        setError(res.error);
        const key = res.error.fieldErrors?.body?.[0];
        if (key) setFieldError(t(`errors.${key}`, { max: REQUEST_LIMITS.body }));
        return;
      }
      setError(null);
      setBody('');
      setPicked(null);
      setId(crypto.randomUUID());
      toast.success(t('requests.memo.sent'));
      router.refresh();
    });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    send();
  };

  const chipTexts = chips ? (t.raw('requests.chat.chips') as string[]) : [];

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5" noValidate>
      <ActionError error={error} />
      {chipTexts.length ? (
        <div className="-mx-1 flex scrollbar-none gap-2 overflow-x-auto px-1">
          {chipTexts.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setBody((b) => (b ? `${b} ${c}` : c))}
              className="hover:bg-muted shrink-0 rounded-full border px-3 py-1.5 text-[13px]"
              data-ui-key="memo-chat-chip"
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}
      {picked ? (
        <span className="bg-muted inline-flex max-w-full items-center gap-1.5 self-start rounded-full py-1 pr-1.5 pl-3 text-[13px]">
          {picked.type === 'designs' ? (
            <FileImage aria-hidden className="size-3.5 shrink-0" />
          ) : (
            <Package aria-hidden className="size-3.5 shrink-0" />
          )}
          <span className="truncate">
            {t(`requests.chat.targetKind.${picked.type}`)} · {picked.label}
          </span>
          <button
            type="button"
            onClick={() => setPicked(null)}
            aria-label={t('requests.chat.unlink')}
            className="hover:bg-background grid size-5 place-items-center rounded-full"
            data-ui-key="memo-chat-unlink"
          >
            <X aria-hidden className="size-3" />
          </button>
        </span>
      ) : null}
      <div
        className={cn(
          'bg-card focus-within:ring-ring/40 flex items-end gap-1.5 rounded-[18px] border p-1.5 shadow-[0_2px_12px_rgb(0_0_0/0.05)] focus-within:ring-2',
          fieldError && 'border-destructive',
        )}
      >
        {!fixedTarget && targets.length ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t('requests.chat.attach')}
              className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-9 shrink-0 place-items-center rounded-full"
              data-ui-key="memo-chat-attach"
            >
              <Paperclip aria-hidden className="size-[18px]" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="max-h-72 min-w-56">
              <DropdownMenuLabel>{t('requests.chat.attach')}</DropdownMenuLabel>
              {targets.map((x) => (
                <DropdownMenuItem
                  key={`${x.type}-${x.id}`}
                  onClick={() => setPicked(x)}
                  data-ui-key="memo-chat-attach-item"
                >
                  {x.type === 'designs' ? (
                    <FileImage aria-hidden className="size-4" />
                  ) : (
                    <Package aria-hidden className="size-4" />
                  )}
                  <span className="truncate">{x.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <label htmlFor={inputId} className="sr-only">
          {t('requests.memo.placeholder')}
        </label>
        <textarea
          id={inputId}
          rows={1}
          value={body}
          maxLength={REQUEST_LIMITS.body}
          placeholder={
            fixedTarget ? t('requests.chat.placeholderItem') : t('requests.chat.placeholder')
          }
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? `${inputId}-error` : undefined}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          className="placeholder:text-muted-foreground field-sizing-content max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          aria-label={t('requests.memo.send')}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-(--chat-mine,var(--primary)) text-(--chat-mine-foreground,var(--primary-foreground)) disabled:opacity-60"
          data-ui-key="item-memo-send"
        >
          <Send aria-hidden className="size-4" />
        </button>
      </div>
      {fieldError ? (
        <p id={`${inputId}-error`} className="text-destructive text-meta">
          {fieldError}
        </p>
      ) : null}
    </form>
  );
}

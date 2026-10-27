'use client';
// 업로드 목록 — 순서대로 올리고, 실패한 파일만 다시 시도 (REQ-061, NFR-008, INT-06)
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { FinalizedFile } from '@/shared/contracts/integration';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { StatusBadge } from '@/shared/ui/status-badge';
import { FileDropzone } from '@/features/files/components/FileDropzone';
import { uploadFile, type UploadOutcome, type UploadTarget } from '@/features/files/lib/upload';

type Phase = 'queued' | 'checking' | 'uploading' | 'processing' | 'done' | 'failed';
interface Item {
  key: string;
  file: File;
  phase: Phase;
  outcome?: UploadOutcome;
}

export type UploadedFile = FinalizedFile & {
  status: 'ready';
  name: string;
  /** D-21: 브라우저에서 고른 원본 파일 (같은 이미지를 비교 이미지로도 올릴 때 사용) */
  source?: File;
};

export function UploadQueue({
  target,
  multiple = false,
  max = 1,
  disabled = false,
  onUploaded,
  onBusyChange,
  uiKey,
}: {
  target: UploadTarget;
  multiple?: boolean;
  max?: number;
  disabled?: boolean;
  onUploaded: (file: UploadedFile) => void;
  onBusyChange?: (busy: boolean) => void;
  uiKey?: string;
}) {
  const t = useTranslations('files');
  const te = useTranslations('errors');
  const [items, setItems] = useState<Item[]>([]);
  const running = useRef(false);
  const busy = items.some((i) => i.phase !== 'done' && i.phase !== 'failed');

  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);

  // 업로드 중 페이지 이탈 경고
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  const patch = useCallback(
    (key: string, next: Partial<Item>) =>
      setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...next } : i))),
    [],
  );

  const run = useCallback(
    async (queue: Item[]) => {
      if (running.current) return;
      running.current = true;
      for (const item of queue) {
        const outcome = await uploadFile(item.file, target, (phase) => patch(item.key, { phase }));
        patch(item.key, { phase: outcome.ok ? 'done' : 'failed', outcome });
        if (outcome.ok) onUploaded({ ...outcome.file, name: item.file.name, source: item.file });
      }
      running.current = false;
    },
    [target, onUploaded, patch],
  );

  const add = (files: File[]) => {
    const next = files.map((file) => ({
      key: crypto.randomUUID(),
      file,
      phase: 'queued' as const,
    }));
    setItems((prev) => (multiple ? [...prev.filter((i) => i.phase !== 'done'), ...next] : next));
    void run(next);
  };

  const retryFailed = () => {
    const failed = items.filter((i) => i.phase === 'failed');
    failed.forEach((i) => patch(i.key, { phase: 'queued', outcome: undefined }));
    void run(failed);
  };

  const describe = (item: Item): string => {
    switch (item.phase) {
      case 'queued':
      case 'checking':
        return t('status.pending');
      case 'uploading':
        return t('queue.uploadingIndeterminate');
      case 'processing':
        return t('queue.processing');
      case 'done':
        return t('status.ready');
      case 'failed':
        return t('queue.failedItem', { name: item.file.name, reason: reason(item.outcome) });
    }
  };

  const reason = (o: UploadOutcome | undefined): string => {
    if (!o || o.ok) return '';
    if ('precheck' in o) {
      if (o.precheck === 'heic') return t('dropzone.heic');
      if (o.precheck === 'renamed') return t('dropzone.renamedExt');
      return te(o.precheck === 'size' ? 'FILE_TOO_LARGE' : 'FILE_TYPE_REJECTED');
    }
    if ('rejectReason' in o) return t(`rejectReason.${o.rejectReason}`);
    if ('interrupted' in o) return t('queue.interrupted');
    return o.ref ? `${te(o.code)} (${o.ref})` : te(o.code);
  };

  const failedCount = items.filter((i) => i.phase === 'failed').length;
  const finished = items.length > 0 && !busy;

  return (
    <div className="flex flex-col gap-2">
      <FileDropzone
        kind={target.kind}
        multiple={multiple}
        max={max}
        disabled={disabled || busy}
        onFiles={add}
        uiKey={uiKey}
      />
      {items.length > 0 ? (
        <section aria-label={t('queue.title')} className="flex min-w-0 flex-col gap-1 text-sm">
          <ul className="flex flex-col gap-1" aria-live="polite">
            {items.map((item) => (
              <li
                key={item.key}
                data-key={item.key}
                data-phase={item.phase}
                className="bg-card flex min-w-0 flex-wrap items-center gap-2 rounded-md border px-2 py-1"
              >
                <span className="min-w-0 flex-1 truncate">{item.file.name}</span>
                {/* 파일 상태 3톤 (02 문서 7.2): 확인 중 info · 사용 가능 positive · 거절 critical */}
                <StatusBadge
                  status={
                    item.phase === 'done'
                      ? 'file_ready'
                      : item.phase === 'failed'
                        ? 'file_rejected'
                        : 'file_pending'
                  }
                  label={item.phase === 'failed' ? t('status.rejected') : describe(item)}
                />
                {item.phase === 'failed' ? (
                  <span className="text-meta text-destructive w-full break-words">
                    {describe(item)}
                  </span>
                ) : null}
                {item.phase === 'failed' || item.phase === 'done' ? (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                    aria-label={`${t('queue.remove')}: ${item.file.name}`}
                    data-ui-key="upload-queue-remove"
                  >
                    <X aria-hidden />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          {finished && failedCount > 0 ? (
            <div
              role="alert"
              className="text-destructive flex flex-wrap items-center justify-between gap-2"
            >
              <span>
                {items.length > 1
                  ? t('queue.partial', { total: items.length, failed: failedCount })
                  : t('queue.retryHint')}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={retryFailed}
                data-ui-key="upload-queue-retry"
              >
                <RefreshCw aria-hidden />
                {t('queue.retry')}
              </Button>
            </div>
          ) : null}
          {finished && failedCount === 0 ? (
            <p className="text-muted-foreground">{t('queue.done')}</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

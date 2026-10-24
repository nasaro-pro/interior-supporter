'use client';
// 견적 PDF 미리보기 (REQ-132) — 권한 재검사 라우트에서 받은 같은 버전의 바이트를 pdfjs 로 그린다
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { routes } from '@/shared/contracts/routes';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ListSkeleton } from '@/shared/ui/states';
import { fetchFileBytes, openPdf, PdfError } from '@/features/designs/lib/pdf';

const MAX_PAGES = 30;

export function PdfPreview({ fileId, title }: { fileId: string; title: string }) {
  const t = useTranslations('estimates');
  const tc = useTranslations('common');
  const holder = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed' | 'password'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const el = holder.current;
    if (!el) return;
    el.replaceChildren();
    setState('loading');
    (async () => {
      try {
        const bytes = await fetchFileBytes(routes.file(fileId));
        const doc = await openPdf(bytes);
        try {
          const width = Math.max(320, el.clientWidth || 800);
          const count = Math.min(doc.numPages, MAX_PAGES);
          setTruncated(doc.numPages > MAX_PAGES);
          for (let i = 1; i <= count && !cancelled; i++) {
            const page = await doc.getPage(i);
            const base = page.getViewport({ scale: 1 });
            const ratio = window.devicePixelRatio || 1;
            const viewport = page.getViewport({ scale: (width / base.width) * ratio });
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(viewport.width);
            canvas.height = Math.round(viewport.height);
            canvas.style.width = '100%';
            canvas.setAttribute('aria-label', `${title} ${i}/${doc.numPages}`);
            canvas.setAttribute('role', 'img');
            canvas.className = 'rounded-sm border border-border bg-background';
            await page.render({ canvas, viewport }).promise;
            if (!cancelled) el.appendChild(canvas);
          }
        } finally {
          void doc.loadingTask.destroy();
        }
        if (!cancelled) setState('ready');
      } catch (e) {
        if (!cancelled)
          setState(e instanceof PdfError && e.reason === 'password' ? 'password' : 'failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileId, title, attempt]);

  return (
    <section aria-label={t('action.preview')} className="flex flex-col gap-2">
      {state === 'loading' ? (
        <ListSkeleton variant="detail" rows={1} label={tc('state.loading')} />
      ) : null}
      {state === 'failed' || state === 'password' ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-8 text-center text-sm"
        >
          <span>{t('preview.failed')}</span>
          {state === 'failed' ? (
            <Button
              variant="outline"
              onClick={() => setAttempt((n) => n + 1)}
              data-ui-key="estimate-preview-retry"
            >
              <RefreshCw aria-hidden />
              {tc('action.retry')}
            </Button>
          ) : null}
        </div>
      ) : null}
      <div ref={holder} className="flex min-w-0 flex-col gap-3" />
      {state === 'ready' && truncated ? (
        <p className="text-meta text-muted-foreground">
          {t('preview.truncated', { max: MAX_PAGES })}
        </p>
      ) : null}
    </section>
  );
}

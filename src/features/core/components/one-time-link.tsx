'use client';
// src/features/core/components/one-time-link.tsx (A · REQ-003·005) — 초대·재설정 링크를 한 번만 보여 주는 대화상자 (02 문서 6.7)
// 메일 발송 없음 — 복사해 직접 전달. 닫으면 다시 볼 수 없다 (DB 에는 해시만 저장)
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { formatDateTime } from '@/shared/lib/dates';

export function OneTimeLinkDialog({
  link,
  expiresAt,
  title,
  description,
  onClose,
}: {
  link: string | null;
  expiresAt?: string;
  title: string;
  description: string;
  onClose: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() === 'en' ? 'en' : 'ko';
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t('common.toast.copied'));
    } catch (e) {
      void e; // 클립보드 권한 거부 — 사용자가 직접 선택해 복사하도록 안내
      toast.error(t('common.toast.copyFailed'));
    }
  };
  return (
    <Dialog open={link !== null} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label htmlFor="one-time-link" className="sr-only">
            {title}
          </label>
          <Input
            id="one-time-link"
            readOnly
            value={link ?? ''}
            onFocus={(e) => e.currentTarget.select()}
            className="font-mono text-xs"
          />
          {expiresAt ? (
            <p className="text-muted-foreground text-meta">
              {t('projects.invite.expiresAt', { datetime: formatDateTime(expiresAt, locale) })}
            </p>
          ) : null}
          <p className="text-meta text-tone-attention-fg">{t('projects.invite.closeWarning')}</p>
        </div>
        <DialogFooter>
          <Button onClick={copy} data-ui-key="one-time-link-copy">
            <Copy aria-hidden />
            {t('common.action.copyLink')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

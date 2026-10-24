'use client';
// src/features/core/components/mark-all-read.tsx (A · TASK-010) — 모두 읽음으로 표시
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CheckCheck } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { markAllNotificationsRead } from '../server/notification-actions';
import type { Area } from '../server/notification-queries';

export function MarkAllReadButton({ area, slug }: { area: Area; slug?: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      aria-busy={pending}
      data-ui-key="notifications-mark-all-read"
      onClick={() =>
        start(async () => {
          const res = await markAllNotificationsRead(area, slug || undefined);
          if (res.ok) {
            toast.success(t('notifications.toast.allRead'));
            router.refresh();
          } else toast.error(t(`errors.${res.error.code}`));
        })
      }
    >
      <CheckCheck aria-hidden />
      {t('notifications.action.markAllRead')}
    </Button>
  );
}

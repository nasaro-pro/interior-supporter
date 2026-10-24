'use client';
// src/app/error.tsx (A) — 예상 못 한 오류: 재시도 + 문의 코드(digest). 스택·SQL 메시지를 보여 주지 않는다 (헌법 7.4)
import { useTranslations } from 'next-intl';
import { Button } from '@/shared/ui/button';
import { ErrorState } from '@/shared/ui/states';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common');
  return (
    <div className="page-container flex min-h-[60dvh] items-center justify-center py-10">
      <div className="w-full max-w-lg">
        <ErrorState
          errorRef={error.digest}
          action={
            <Button onClick={reset} data-ui-key="error-retry">
              {t('action.retry')}
            </Button>
          }
        />
      </div>
    </div>
  );
}

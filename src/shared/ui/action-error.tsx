'use client';
// src/shared/ui/action-error.tsx (A) — Server Action 실패 표시: errors.<code> + 문의 코드, 충돌이면 [최신 내용 불러오기]
// 02 문서 5장 상태 6종 "충돌(VERSION_CONFLICT·STALE_REVISION → 새로고침 안내)". 입력값은 클라이언트 상태라 유지된다
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import type { AppError } from '@/shared/contracts/errors';

const CONFLICT_CODES = new Set(['VERSION_CONFLICT', 'STALE_REVISION', 'CONFLICT']);

/** 최신 내용을 다시 불러와야 하는 오류인가 */
export function isConflictCode(code: string): boolean {
  return CONFLICT_CODES.has(code);
}

/** toast 등 한 줄 문구: "오류 문구 (문의 코드)" */
export function useActionErrorText() {
  const t = useTranslations();
  return useCallback(
    (error: AppError) => {
      const msg = t(`errors.${error.code}`);
      return error.ref ? `${msg} (${t('common.state.errorRef', { ref: error.ref })})` : msg;
    },
    [t],
  );
}

export function ActionError({
  error,
  onReload,
  className,
  uiKey = 'conflict-load-latest',
}: {
  error: AppError | null | undefined;
  /** 최신 불러오기 뒤 호출 (폼 초기화·draft 갱신 등) */
  onReload?: () => void;
  className?: string;
  uiKey?: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  if (!error) return null;
  const conflict = isConflictCode(error.code);
  return (
    <div
      role="alert"
      data-error-code={error.code}
      className={cn(
        'border-destructive/40 bg-tone-critical-bg text-tone-critical-fg flex flex-col gap-2 rounded-md border px-3 py-2 text-sm',
        className,
      )}
    >
      <p>{t(`errors.${error.code}`)}</p>
      {error.ref ? (
        <p className="text-meta">{t('common.state.errorRef', { ref: error.ref })}</p>
      ) : null}
      {conflict ? (
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-ui-key={uiKey}
            onClick={() => {
              router.refresh();
              onReload?.();
            }}
          >
            <RefreshCw aria-hidden />
            {t('common.action.loadLatest')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

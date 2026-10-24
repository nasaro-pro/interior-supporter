// src/shared/ui/states.tsx (A) — 화면 상태 6종 공통 컴포넌트 (02 문서 5장): EmptyState·ErrorState·ForbiddenState·FilterEmptyState·ConflictState·ListSkeleton
// 루트마다 data-ui-key: state-empty · state-filter-empty · state-error · state-forbidden · state-not-found · state-conflict
import type { ReactNode } from 'react';
import { FileQuestion, Inbox, RefreshCw, SearchX, ShieldAlert, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Button, buttonVariants } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/lib/utils';

function StateBox({
  icon,
  title,
  children,
  action,
  role,
  className,
  uiKey,
  titleAs: TitleTag = 'p',
}: {
  icon: ReactNode;
  title: string;
  /** 제목 요소. 화면 전체가 이 상태 하나일 때(SYS-404 등) h1 로 문서 제목을 준다 */
  titleAs?: 'p' | 'h1' | 'h2';
  children?: ReactNode;
  action?: ReactNode;
  role?: 'alert' | 'status';
  className?: string;
  /** 상태 종류 표식 (data-ui-key) — e2e 가 화면 상태를 찾는 기준 */
  uiKey: string;
}) {
  return (
    <div
      role={role}
      data-ui-key={uiKey}
      className={cn(
        'flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-10 text-center',
        className,
      )}
    >
      <span aria-hidden className="text-muted-foreground [&>svg]:size-8">
        {icon}
      </span>
      <TitleTag className="text-base font-medium">{title}</TitleTag>
      {children ? <div className="text-muted-foreground max-w-prose">{children}</div> : null}
      {action ? <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** 빈 상태 + 다음 행동 버튼 */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** 기본 Inbox (lucide 요소) */
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <StateBox
      icon={icon ?? <Inbox />}
      title={title}
      action={action}
      role="status"
      className={className}
      uiKey="state-empty"
    >
      {description}
    </StateBox>
  );
}

/** 필터 결과 없음 + 초기화 (resetHref 를 주면 [필터 초기화] 링크를 그린다) */
export function FilterEmptyState({
  action,
  message,
  resetHref,
  resetLabel,
}: {
  action?: ReactNode;
  message?: string;
  resetHref?: string;
  resetLabel?: string;
}) {
  const t = useTranslations('common');
  const reset = resetHref ? (
    <Link
      href={resetHref}
      scroll={false}
      data-ui-key="filter-reset"
      className={buttonVariants({ variant: 'outline' })}
    >
      {resetLabel ?? t('action.resetFilters')}
    </Link>
  ) : null;
  return (
    <StateBox
      icon={<SearchX />}
      title={message ?? t('state.filterEmpty')}
      action={
        action || reset ? (
          <>
            {reset}
            {action}
          </>
        ) : undefined
      }
      role="status"
      uiKey="state-filter-empty"
    />
  );
}

/** 오류 + 재시도 + 문의 코드(ref) */
export function ErrorState({
  message,
  errorRef,
  action,
  onRetry,
  retryLabel,
}: {
  message?: string;
  errorRef?: string;
  action?: ReactNode;
  /** 클라이언트에서만: [다시 시도] 버튼 (error.tsx 의 reset 등) */
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const t = useTranslations('common');
  const retry = onRetry ? (
    <Button variant="outline" onClick={onRetry} data-ui-key="error-retry">
      {retryLabel ?? t('action.retry')}
    </Button>
  ) : null;
  return (
    <StateBox
      icon={<TriangleAlert />}
      title={message ?? t('state.error')}
      action={
        action || retry ? (
          <>
            {retry}
            {action}
          </>
        ) : undefined
      }
      role="alert"
      uiKey="state-error"
    >
      {errorRef ? t('state.errorRef', { ref: errorRef }) : null}
    </StateBox>
  );
}

/** 권한 없음 (SYS-403 화면 본문으로도 쓰임) */
export function ForbiddenState({ action }: { action?: ReactNode }) {
  const t = useTranslations('common');
  return (
    <StateBox
      icon={<ShieldAlert />}
      title={t('screen.forbidden')}
      action={action}
      role="alert"
      uiKey="state-forbidden"
    >
      {t('state.forbidden')}
    </StateBox>
  );
}

/** 없음 (SYS-404 본문) */
export function NotFoundState({
  action,
  titleAs,
}: {
  action?: ReactNode;
  titleAs?: 'p' | 'h1' | 'h2';
}) {
  const t = useTranslations('common');
  return (
    <StateBox
      icon={<FileQuestion />}
      title={t('screen.notFound')}
      titleAs={titleAs}
      action={action}
      role="alert"
      uiKey="state-not-found"
    >
      {t('state.notFound')}
    </StateBox>
  );
}

/** 충돌 (VERSION_CONFLICT · STALE_REVISION) → 새로고침 안내 */
export function ConflictState({ action }: { action?: ReactNode }) {
  const t = useTranslations('common');
  return (
    <StateBox
      icon={<RefreshCw />}
      title={t('state.versionConflict')}
      action={action}
      role="alert"
      uiKey="state-conflict"
    />
  );
}

/** 로딩 (Skeleton) — list: 줄 · grid: 카드 격자 · detail: 상세(제목·메타·본문). 움직임 줄이기 설정이면 깜빡임 없음 */
export function ListSkeleton({
  rows = 5,
  variant = 'list',
  label,
}: {
  rows?: number;
  variant?: 'list' | 'grid' | 'detail';
  label?: string;
}) {
  const t = useTranslations('common');
  const a11y = { role: 'status' as const, 'aria-label': label ?? t('a11y.loading') };
  if (variant === 'grid') {
    return (
      <div {...a11y} data-variant="grid" className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="aspect-[4/3] w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    );
  }
  if (variant === 'detail') {
    return (
      <div {...a11y} data-variant="detail" className="flex flex-col gap-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-56 w-full" />
        {Array.from({ length: Math.min(rows, 3) }, (_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }
  return (
    <div {...a11y} data-variant="list" className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

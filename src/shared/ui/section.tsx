// src/shared/ui/section.tsx (A) — 페이지 안 구획: 머리(제목·설명·보조 정보·행동) + 본문. 서버·클라이언트 공용
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

export function SectionHeader({
  title,
  description,
  meta,
  actions,
  as: Tag = 'h2',
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** 오른쪽 작은 보조 정보 (예: 건수) */
  meta?: ReactNode;
  actions?: ReactNode;
  as?: 'h2' | 'h3';
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-2', className)}>
      <div className="min-w-0">
        <Tag className={cn('font-semibold', Tag === 'h2' ? 'text-lg' : 'text-base')}>{title}</Tag>
        {description ? (
          <p className="text-muted-foreground text-meta mt-0.5">{description}</p>
        ) : null}
      </div>
      {meta || actions ? (
        <div className="flex flex-wrap items-center gap-2">
          {meta ? (
            <span className="text-muted-foreground text-meta" data-numeric>
              {meta}
            </span>
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function Section({
  title,
  description,
  meta,
  actions,
  as,
  label,
  variant = 'plain',
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  as?: 'h2' | 'h3';
  /** 제목이 없거나 문자열이 아닐 때 구획 이름 (aria-label) */
  label?: string;
  /** card: 카드 면(테두리·그림자 1단) */
  variant?: 'plain' | 'card';
  className?: string;
  children?: ReactNode;
}) {
  const name = label ?? (typeof title === 'string' ? title : undefined);
  return (
    <section
      aria-label={name}
      className={cn(
        'flex min-w-0 flex-col gap-3',
        variant === 'card' && 'bg-card rounded-lg border p-4 shadow-sm',
        className,
      )}
    >
      {title ? (
        <SectionHeader
          title={title}
          description={description}
          meta={meta}
          actions={actions}
          as={as}
        />
      ) : null}
      {children}
    </section>
  );
}

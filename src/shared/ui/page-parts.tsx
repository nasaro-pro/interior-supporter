// src/shared/ui/page-parts.tsx (A) — 페이지 머리·더 보기(30개 단위)·브레드크럼 (02 문서 2.1·5장)
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ButtonLink } from '@/shared/ui/button-link';

/** 페이지 머리: 제목(h1 24px) · 설명 · 보조 정보(건수 등) · 행동 칸. eyebrow(영역/순번)는 사양에 없다 */
export function PageHeader({
  title,
  description,
  meta,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** 설명 아래 작은 보조 정보 (예: '12건') */
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight wrap-anywhere">{title}</h1>
        {description ? <p className="text-muted-foreground mt-1">{description}</p> : null}
        {meta ? (
          <p className="text-muted-foreground text-meta mt-1" data-numeric>
            {meta}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** '더 보기'(30개 단위) — href 는 routes 로 만든 경로 + ?cursor= · ?size= · ?limit= 어느 쿼리든. null 이면 그리지 않음 */
export function LoadMore({
  href,
  label,
  uiKey = 'list-load-more',
}: {
  href: string | null | undefined;
  label?: string;
  uiKey?: string;
}) {
  const t = useTranslations('common');
  if (!href) return null;
  return (
    <div className="flex justify-center pt-2">
      <ButtonLink href={href} scroll={false} variant="outline" data-ui-key={uiKey}>
        {label ?? t('action.loadMore')}
      </ButtonLink>
    </div>
  );
}

/** D1 › D2 › D3 › D4 */
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  const t = useTranslations('common');
  return (
    <nav aria-label={t('nav.breadcrumb')} className="text-muted-foreground text-meta">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, i) => (
          <li key={`${it.label}-${i}`} className="flex min-w-0 items-center gap-1 wrap-anywhere">
            {i > 0 ? <ChevronRight aria-hidden className="size-3 shrink-0" /> : null}
            {it.href && i < items.length - 1 ? (
              <Link
                href={it.href}
                className="hover:text-foreground underline-offset-4 hover:underline"
              >
                {it.label}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? 'page' : undefined}>{it.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

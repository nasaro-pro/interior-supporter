// 일정 상세 PM-18 / CL-18 — 일시·내용·관련 프로젝트·관련 항목 링크(접근 가능한 것만) (REQ-232)
// 헤더(제목·배지·일시) → 본문(정보) | 사이드(관리) — 02 문서 5장 상세 규칙
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Archive, ArrowLeft, Link2 } from 'lucide-react';
import { PhotoVisibilityBadge } from '@/features/photos';
import type { DateLocale } from '@/shared/lib/dates';
import { cn } from '@/shared/lib/utils';
import { ButtonLink } from '@/shared/ui/button-link';
import { Notice } from '@/shared/ui/notice';
import { Section } from '@/shared/ui/section';
import { linkClass } from '@/shared/ui/styles';
import { ToneBadge } from '@/shared/ui/tone-badge';
import { formatEventWhen } from '../lib/format';
import type { RelatedType } from '../schema';
import type { ScheduleEvent } from '../types';

export function ScheduleDetailView({
  event,
  listHref,
  project,
  related,
  showVisibility,
  actions,
}: {
  event: ScheduleEvent;
  listHref: string;
  project: { name: string; href: string };
  /** null = 연결 없음, 'unavailable' = 연결됐지만 볼 수 없음 */
  related:
    | { type: RelatedType; label: string; href: string; projectName: string | null }
    | 'unavailable'
    | null;
  showVisibility: boolean;
  actions?: ReactNode;
}) {
  const t = useTranslations('schedule');
  const tc = useTranslations('common');
  const locale = useLocale() as DateLocale;
  const when = formatEventWhen(event, locale, { allDay: t('field.allDay') });
  return (
    <>
      <header className="flex flex-col gap-3">
        <div>
          <ButtonLink href={listHref} variant="ghost" size="sm" data-ui-key="schedule-detail-back">
            <ArrowLeft aria-hidden />
            {t('screen.list')}
          </ButtonLink>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-xl font-semibold tracking-tight break-words">{event.title}</h2>
            <p className="text-muted-foreground text-sm" data-numeric>
              {when}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {event.archived ? (
              <ToneBadge tone="neutral" icon={Archive}>
                {tc('filter.archived')}
              </ToneBadge>
            ) : null}
            {/* 공개/비공개 배지는 사진과 같은 표시 (02 문서 7.2) */}
            {showVisibility ? <PhotoVisibilityBadge isPublic={event.isPublic} /> : null}
          </div>
        </div>
        {event.archived ? <Notice tone="neutral">{tc('state.archivedItem')}</Notice> : null}
      </header>
      <div className={cn('grid gap-6', actions ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : undefined)}>
        <Section title={t('detail.info')} as="h3" variant="card">
          <dl className="flex flex-col gap-3 text-sm">
            <Row label={t('field.when')}>
              <span data-numeric>{when}</span>
            </Row>
            <Row label={t('field.project')}>
              <Link href={project.href} className={linkClass}>
                {project.name}
              </Link>
            </Row>
            <Row label={t('field.related')}>
              {related === null ? (
                <span className="text-muted-foreground">{t('form.relatedNone')}</span>
              ) : related === 'unavailable' ? (
                <span className="text-muted-foreground">{t('detail.relatedUnavailable')}</span>
              ) : (
                <Link
                  href={related.href}
                  className={cn(linkClass, 'inline-flex flex-wrap items-center gap-1.5')}
                  data-ui-key="schedule-related-open"
                >
                  <Link2 className="size-4" aria-hidden />
                  {t(`relatedType.${related.type}`)} · {related.label}
                  {related.projectName ? (
                    <span className="text-muted-foreground text-meta">
                      ({t('detail.otherProject', { name: related.projectName })})
                    </span>
                  ) : null}
                </Link>
              )}
            </Row>
            <Row label={t('field.description')}>
              <span className="break-words whitespace-pre-wrap">
                {event.description || t('detail.noDescription')}
              </span>
            </Row>
          </dl>
        </Section>
        {actions ? (
          <aside className="min-w-0">
            <Section title={t('detail.manage')} as="h3" variant="card">
              {actions}
            </Section>
          </aside>
        ) : null}
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-muted-foreground text-meta">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

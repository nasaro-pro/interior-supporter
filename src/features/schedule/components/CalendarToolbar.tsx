// 달 이동(이전·다음·오늘) + 보기 전환(월간·타임라인) — 링크 기반 (새로고침·뒤로가기 유지)
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ButtonLink } from '@/shared/ui/button-link';
import { SegmentedTabs } from '@/shared/ui/segmented-tabs';

export function MonthNav({
  title,
  prevHref,
  nextHref,
  todayHref,
}: {
  title: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
}) {
  const t = useTranslations('schedule.view');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ButtonLink
        href={prevHref}
        scroll={false}
        variant="outline"
        size="icon"
        aria-label={t('prevMonth')}
        data-ui-key="calendar-prev-month"
      >
        <ChevronLeft aria-hidden />
      </ButtonLink>
      <h2 className="min-w-28 text-center text-lg font-semibold tabular-nums">{title}</h2>
      <ButtonLink
        href={nextHref}
        scroll={false}
        variant="outline"
        size="icon"
        aria-label={t('nextMonth')}
        data-ui-key="calendar-next-month"
      >
        <ChevronRight aria-hidden />
      </ButtonLink>
      <ButtonLink href={todayHref} scroll={false} variant="outline" data-ui-key="calendar-today">
        {t('today')}
      </ButtonLink>
    </div>
  );
}

export function ViewSwitch({
  current,
  monthHref,
  timelineHref,
}: {
  current: 'month' | 'timeline';
  monthHref: string;
  timelineHref: string;
}) {
  const t = useTranslations('schedule.view');
  return (
    <SegmentedTabs
      label={t('label')}
      items={[
        {
          key: 'month',
          href: monthHref,
          label: t('month'),
          current: current === 'month',
          uiKey: 'schedule-view-month',
        },
        {
          key: 'timeline',
          href: timelineHref,
          label: t('timeline'),
          current: current === 'timeline',
          uiKey: 'schedule-view-timeline',
        },
      ]}
    />
  );
}

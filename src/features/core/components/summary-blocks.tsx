// src/features/core/components/summary-blocks.tsx (A · TASK-006·009) — 개요·고객 홈의 요약 블록 (원본 D4 로 링크만, 편집 복제 없음)
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DateText, PeriodText } from '@/shared/ui/date-text';
import { ErrorState } from '@/shared/ui/states';
import type { SummaryItem } from '@/shared/contracts/integration';
import type { HomeSectionKey } from '@/shared/contracts/domain';
import { cn } from '@/shared/lib/utils';
import { HOME_THEME_CLASS } from '../home-theme';
import type { Block } from '../server/overview-queries';
import type { ProjectDetail } from '../types';

function SummaryList({
  block,
  emptyText,
  customer = false,
}: {
  block: Block;
  emptyText: string;
  /** 고객 홈: 요청을 '메모'로 부른다 (CU-06 — 고객 화면의 요청 탭은 '메모 대화') */
  customer?: boolean;
}) {
  const t = useTranslations();
  if (block.failed && block.items.length === 0) return <ErrorState />;
  if (block.items.length === 0) return <p className="text-muted-foreground py-2">{emptyText}</p>;
  return (
    <ul className="divide-y">
      {block.items.map((it: SummaryItem) => (
        <li key={`${it.kind}-${it.id}`} data-key={it.id}>
          <Link
            href={it.href}
            className="hover:bg-accent/60 -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5"
            data-ui-key="summary-item-open"
          >
            <span className="min-w-0">
              <span className="text-muted-foreground text-meta block">
                {customer && it.kind === 'requests'
                  ? t('requests.memo.title')
                  : t(`history.objectType.${it.kind}`)}
              </span>
              <span className="block truncate font-medium">{it.title}</span>
              {it.subtitleKey && t.has(it.subtitleKey) ? (
                <span className="text-muted-foreground text-meta block">
                  {t(it.subtitleKey, it.subtitleValues)}
                </span>
              ) : null}
            </span>
            <span className="text-muted-foreground text-meta flex shrink-0 items-center gap-1">
              <DateText value={it.at} />
              <ChevronRight aria-hidden className="size-4" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="bg-card relative min-w-0 overflow-x-clip rounded-lg border p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** 개요(PM-03)의 최근 업데이트·다음 일정 */
export function OverviewBlocks({ recent, schedule }: { recent: Block; schedule: Block }) {
  const t = useTranslations('projects');
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={t('homeSection.recent')}>
        <SummaryList block={recent} emptyText={t('overview.recentEmpty')} />
      </Panel>
      <Panel title={t('homeSection.schedule')}>
        <SummaryList block={schedule} emptyText={t('overview.scheduleEmpty')} />
      </Panel>
    </div>
  );
}

/**
 * 고객 홈 본문 (CL-03 과 PM-03 미리보기가 같은 컴포넌트 — 02 문서 6.6).
 * 테마 색 안내문 + 설정된 순서·표시의 4영역 (페이지 이미지·분위기는 PageCanvas 가 감싼다). 비공개 항목은 provider(RLS)가 이미 제외한 결과만 받는다.
 */
export function CustomerHomeBody({
  project,
  blocks,
}: {
  project: Pick<
    ProjectDetail,
    'homeMessage' | 'homeSections' | 'homeTheme' | 'currentPhase' | 'startDate' | 'endDate'
  >;
  blocks: Record<'recent' | 'schedule' | 'documents', Block>;
}) {
  const t = useTranslations('projects');
  const render = (key: HomeSectionKey) => {
    switch (key) {
      case 'overview':
        return (
          <Panel key={key} title={t('homeSection.overview')}>
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-meta">{t('field.currentPhase')}</dt>
                <dd className="font-medium">{project.currentPhase || t('overview.phaseEmpty')}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-meta">{t('field.period')}</dt>
                <dd>
                  <PeriodText
                    from={project.startDate}
                    until={project.endDate}
                    emptyLabel={t('list.noPeriod')}
                  />
                </dd>
              </div>
            </dl>
          </Panel>
        );
      case 'recent':
        return (
          <Panel key={key} title={t('homeSection.recent')}>
            <SummaryList block={blocks.recent} emptyText={t('overview.recentEmpty')} customer />
          </Panel>
        );
      case 'schedule':
        return (
          <Panel key={key} title={t('homeSection.schedule')}>
            <SummaryList block={blocks.schedule} emptyText={t('overview.scheduleEmpty')} />
          </Panel>
        );
      case 'documents':
        return (
          <Panel key={key} title={t('homeSection.documents')}>
            <SummaryList block={blocks.documents} emptyText={t('overview.documentsEmpty')} />
          </Panel>
        );
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <section
        className={cn('rounded-lg p-4 whitespace-pre-line', HOME_THEME_CLASS[project.homeTheme])}
        data-theme-key={project.homeTheme}
      >
        {project.homeMessage || t('home.empty')}
      </section>
      {project.homeSections.filter((s) => s.visible).map((s) => render(s.key))}
    </div>
  );
}

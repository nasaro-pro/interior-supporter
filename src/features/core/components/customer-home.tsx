// src/features/core/components/customer-home.tsx (A · TASK-009, REQ-016) — CL-03 고객 홈 = 마이페이지 (2026-11 새 디자인)
// 칸: 공사 진행(+업체 인사말) → 도안 → 최근 현장 사진 → 다음 일정. 순서 · 표시는 고객 홈 꾸미기 값(home_sections)
//   overview = 공사 진행 · documents = 도안(견적은 홈에 보이지 않음 — 견적 탭에서) · recent = 최근 현장 사진 · schedule = 다음 일정
// 고객 화면(CL-03)과 개요의 고객 화면 미리보기(PM-03)가 같은 컴포넌트를 쓴다. 공개 항목만 (B·C provider 가 고객 권한 RLS 로 조회)
import type { ComponentProps } from 'react';
import Link from 'next/link';
import { ChevronRight, FileImage } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ProjectAccess, SummaryItem } from '@/shared/contracts/integration';
import type { HomeSectionKey } from '@/shared/contracts/domain';
import { routes } from '@/shared/contracts/routes';
import {
  formatCalendarDate,
  formatCalendarTime,
  formatDate,
  todayKst,
  weekdayOf,
  type DateLocale,
} from '@/shared/lib/dates';
import { logger } from '@/shared/lib/logger';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { cn } from '@/shared/lib/utils';
import { documentsProvider as designsDocuments } from '@/features/designs/server/summary';
import { summaryProvider as photosSummary } from '@/features/photos/server/summary';
import { nextScheduleProvider } from '@/features/schedule/server/summary';
import { CUSTOMER_TITLE_CLASS } from '../customer-style';
import type { HomeTheme } from '../home-theme';
import { constructionProgress } from '../my-home';
import type { ProjectDetail } from '../types';
import { EYEBROW } from './portal-project-header';

/** 인사말 왼쪽 선 색 = 고객 홈 꾸미기의 색상 테마 (토큰만) */
const QUOTE_RULE: Record<HomeTheme, string> = {
  brand: 'border-tone-brand-fg',
  info: 'border-tone-info-fg',
  positive: 'border-tone-positive-fg',
  caution: 'border-tone-caution-fg',
  attention: 'border-tone-attention-fg',
  neutral: 'border-tone-neutral-fg',
};

async function safe<T>(label: string, projectId: string, fn: () => Promise<T>, fallback: T) {
  try {
    return { value: await fn(), failed: false };
  } catch (e) {
    logger.warn('customer_home.block.failed', {
      projectId,
      action: label,
      code: e instanceof Error ? e.name : 'unknown',
    });
    return { value: fallback, failed: true };
  }
}

/** 도안 확정 상태 (고객이 볼 수 있는 공개 도안만 — RLS) */
async function confirmStates(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from('designs').select('id, confirm_state').in('id', ids);
  if (error) throw new Error(`customer_home.designs:${error.code ?? 'unknown'}`);
  return new Map((data ?? []).map((d) => [d.id, d.confirm_state]));
}

/**
 * 고객 홈 안 링크. 실제 고객 화면에서는 next/link.
 * 개요의 고객 화면 미리보기(PM-03)에서는 담당자에게 /portal 주소가 404 라서, 미리보기 시작 주소(쿠키를 심는 라우트 핸들러)로
 * 보낸다 → 일반 <a> (클라이언트 이동 · prefetch 금지 — prefetch 가 쿠키를 심으면 안 된다)
 */
function HomeLink({ plain, ...props }: ComponentProps<'a'> & { href: string; plain?: boolean }) {
  return plain ? <a {...props} /> : <Link {...props} />;
}

function SectionHead({
  eyebrow,
  title,
  more,
}: {
  eyebrow: string;
  title: string;
  more?: { href: string; label: string; plain?: boolean };
}) {
  return (
    <div className="flex items-end justify-between gap-3 border-b pb-4">
      <div className="min-w-0">
        <p className={EYEBROW}>{eyebrow}</p>
        <h2 className={cn('mt-2 text-2xl tracking-tight', CUSTOMER_TITLE_CLASS)}>{title}</h2>
      </div>
      {more ? (
        <HomeLink
          plain={more.plain}
          href={more.href}
          className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-0.5 text-sm"
          data-ui-key="customer-home-more"
        >
          {more.label}
          <ChevronRight aria-hidden className="size-4" />
        </HomeLink>
      ) : null}
    </div>
  );
}

const Empty = ({ children }: { children: string }) => (
  <p className="text-muted-foreground py-8 text-sm">{children}</p>
);

export async function CustomerHome({
  project,
  access,
}: {
  project: Pick<
    ProjectDetail,
    | 'id'
    | 'homeMessage'
    | 'homeSections'
    | 'homeTheme'
    | 'currentPhase'
    | 'startDate'
    | 'endDate'
    | 'status'
  >;
  /** 고객 권한(as: 'customer') — 미리보기도 고객과 같은 공개 범위로 */
  access: ProjectAccess;
}) {
  const t = await getTranslations('projects');
  const tm = await getTranslations('projects.myHome');
  const tc = await getTranslations('projects.customerHome');
  const ts = await getTranslations('schedule');
  const locale = ((await getLocale()) === 'en' ? 'en' : 'ko') as DateLocale;
  const projectId = access.projectId;
  // 미리보기면 고객 화면 주소를 '미리보기 시작 → 그 화면' 주소로 감싼다 (담당자는 /portal 에 바로 못 들어간다)
  const preview = access.preview === true;
  const go = (href: string) =>
    preview ? routes.app.customerPreview(access.companySlug, projectId, href) : href;
  const more = (tab: 'designs' | 'photos' | 'schedule') => ({
    href: go(routes.portal.project(projectId, tab)),
    label: tc('all'),
    plain: preview,
  });
  const visible = project.homeSections.filter((s) => s.visible).map((s) => s.key);

  const [designs, photos, schedule] = await Promise.all([
    visible.includes('documents')
      ? safe(
          'designs',
          projectId,
          async () => {
            const items = (await designsDocuments.documents(projectId, access)).slice(0, 3);
            const states = await confirmStates(items.map((d) => d.id));
            return items.map((d) => ({ ...d, confirmState: states.get(d.id) ?? 'none' }));
          },
          [] as (SummaryItem & { confirmState: string })[],
        )
      : null,
    visible.includes('recent')
      ? safe('photos', projectId, () => photosSummary.recent(projectId, access, 3), [])
      : null,
    visible.includes('schedule')
      ? safe('schedule', projectId, () => nextScheduleProvider.next(projectId, access, 3), [])
      : null,
  ]);

  const pr = constructionProgress(project, todayKst());
  const line =
    pr.state === 'during'
      ? tm('progress.during', { day: pr.dayNo ?? 0, left: pr.daysLeft ?? 0 })
      : pr.state === 'before'
        ? tm('progress.before', { days: pr.daysToStart ?? 0 })
        : pr.state === 'after'
          ? tm('progress.after')
          : pr.state === 'done'
            ? tm('progress.done')
            : tm('progress.unknown');
  const period =
    project.startDate || project.endDate
      ? `${project.startDate ? formatCalendarDate(project.startDate, locale) : '…'} ~ ${
          project.endDate ? formatCalendarDate(project.endDate, locale) : '…'
        }`
      : tm('noPeriod');

  const render = (key: HomeSectionKey) => {
    switch (key) {
      case 'overview':
        return (
          <section
            key={key}
            className="grid gap-8 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:gap-16"
            data-ui-key="customer-home-progress"
            data-state={pr.state}
          >
            <div className="min-w-0">
              <p className={EYEBROW}>{tc('progressEyebrow')}</p>
              <p
                className={cn(
                  'mt-4 text-[44px] leading-none tracking-tight wrap-anywhere md:text-[56px]',
                  CUSTOMER_TITLE_CLASS,
                )}
              >
                {project.currentPhase || tm('phaseEmpty')}
              </p>
              <p className="text-muted-foreground mt-3 text-sm" data-numeric>
                {t('field.currentPhase')} · {period}
              </p>
              {pr.percent !== null ? (
                <div
                  role="progressbar"
                  aria-label={tm('progressTitle')}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pr.percent}
                  aria-valuetext={line}
                  className="bg-muted mt-6 h-[3px] w-full"
                >
                  <div className="bg-primary h-full" style={{ width: `${pr.percent}%` }} />
                </div>
              ) : null}
              <p className="mt-3 text-sm" data-numeric>
                {line}
              </p>
            </div>
            <blockquote
              className={cn('border-l-2 pl-5 md:self-end md:pl-6', QUOTE_RULE[project.homeTheme])}
              data-theme-key={project.homeTheme}
            >
              <p className="text-lg leading-relaxed whitespace-pre-line md:text-xl">
                {project.homeMessage || t('home.empty')}
              </p>
            </blockquote>
          </section>
        );
      case 'documents':
        return (
          <section key={key}>
            <SectionHead
              eyebrow="Designs"
              title={t('homeSection.documents')}
              more={more('designs')}
            />
            {designs?.failed ? (
              <Empty>{tc('failed')}</Empty>
            ) : !designs?.value.length ? (
              <Empty>{tc('designsEmpty')}</Empty>
            ) : (
              <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
                {designs.value.map((d, i) => (
                  <li key={d.id} className={cn('min-w-0', i === 2 && 'max-md:hidden')}>
                    <HomeLink
                      plain={preview}
                      href={go(d.href)}
                      className="group block"
                      data-ui-key="customer-home-design"
                    >
                      <span className="bg-card text-muted-foreground grid aspect-[4/3] place-items-center overflow-hidden border">
                        {d.thumbnailFileId ? (
                          // eslint-disable-next-line @next/next/no-img-element -- /api/files 가 권한 확인 후 서명 주소로 보낸다
                          <img
                            src={routes.file(d.thumbnailFileId)}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-contain p-2 transition-opacity group-hover:opacity-90"
                          />
                        ) : (
                          <FileImage aria-hidden className="size-6" />
                        )}
                      </span>
                      <span className="mt-3 flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-medium">{d.title}</span>
                          <span
                            className="text-muted-foreground block truncate text-sm"
                            data-numeric
                          >
                            v{String(d.subtitleValues?.no ?? 1)} · {formatDate(d.at, locale)}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
                            d.confirmState === 'confirmed'
                              ? 'bg-tone-positive-bg text-tone-positive-fg'
                              : 'bg-tone-caution-bg text-tone-caution-fg',
                          )}
                        >
                          {d.confirmState === 'confirmed' ? tc('confirmed') : tc('needsCheck')}
                        </span>
                      </span>
                    </HomeLink>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      case 'recent':
        return (
          <section key={key}>
            <SectionHead
              eyebrow="Recent Photos"
              title={t('homeSection.recent')}
              more={more('photos')}
            />
            {photos?.failed ? (
              <Empty>{tm('photosFailed')}</Empty>
            ) : !photos?.value.length ? (
              <Empty>{tm('photosEmpty')}</Empty>
            ) : (
              <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
                {photos.value.map((p, i) => (
                  <li key={p.id} className={cn('min-w-0', i === 2 && 'max-md:hidden')}>
                    <HomeLink
                      plain={preview}
                      href={go(p.href)}
                      className="group block"
                      data-ui-key="customer-home-photo"
                    >
                      <span className="bg-muted block aspect-[4/3] overflow-hidden">
                        {p.thumbnailFileId ? (
                          // eslint-disable-next-line @next/next/no-img-element -- /api/files 가 권한 확인 후 서명 주소로 보낸다
                          <img
                            src={routes.file(p.thumbnailFileId)}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
                          />
                        ) : null}
                      </span>
                      <span className="mt-3 block truncate text-[15px] font-medium">{p.title}</span>
                      <span className="text-muted-foreground block text-sm" data-numeric>
                        {formatDate(p.at, locale)}
                      </span>
                    </HomeLink>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      case 'schedule':
        return (
          <section key={key}>
            <SectionHead
              eyebrow="Schedule"
              title={t('homeSection.schedule')}
              more={more('schedule')}
            />
            {schedule?.failed ? (
              <Empty>{tc('failed')}</Empty>
            ) : !schedule?.value.length ? (
              <Empty>{t('overview.scheduleEmpty')}</Empty>
            ) : (
              <ul className="divide-y">
                {schedule.value.map((e) => {
                  // at = 'YYYY-MM-DDTHH:MM:00+09:00' (시작 시각 없는 일정은 00:00)
                  const ymd = e.at.slice(0, 10);
                  const hm = e.at.slice(11, 16);
                  const [, m, d] = ymd.split('-');
                  return (
                    <li key={e.id}>
                      <HomeLink
                        plain={preview}
                        href={go(e.href)}
                        className="hover:bg-muted/40 -mx-2 flex items-center gap-5 px-2 py-4"
                        data-ui-key="customer-home-event"
                      >
                        <span className="w-16 shrink-0 whitespace-nowrap">
                          <span className="block text-lg font-semibold tabular-nums">
                            {locale === 'ko' ? `${Number(m)}. ${Number(d)}.` : `${m}/${d}`}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {ts(`view.weekdays.${weekdayOf(ymd)}`)}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                          {e.title}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                          {hm && hm !== '00:00'
                            ? formatCalendarTime(hm, locale)
                            : ts('field.allDay')}
                        </span>
                      </HomeLink>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
    }
  };

  return (
    <div className="flex flex-col gap-14 py-6 md:gap-20 md:py-10" data-ui-key="customer-home">
      {visible.map((k) => render(k))}
    </div>
  );
}

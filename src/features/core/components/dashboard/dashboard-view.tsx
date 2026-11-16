// src/features/core/components/dashboard/dashboard-view.tsx (A · PM-00) — 업체 첫 화면 본문
// 25번 시안: 인사 한 줄 → 숫자 4칸 → (왼쪽) 오늘 확인할 일 · 진행 중 프로젝트 / (오른쪽) 이번 주 · 최근 현장 사진
// 색은 배지 7톤 토큰만 쓴다 (hex 없음). 각 칸은 원본 화면(D4)으로 링크만 건다 — 편집은 원본에서.
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileCheck2,
  Hammer,
  ImageIcon,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { routes } from '@/shared/contracts/routes';
import {
  formatCalendarDate,
  formatCalendarTime,
  weekdayOf,
  type DateLocale,
} from '@/shared/lib/dates';
import { cn } from '@/shared/lib/utils';
import { toneClass, type Tone } from '@/shared/ui/tone-badge';
import { ProjectStatusBadge } from '@/features/core/components/project-badges';
import {
  isOnDay,
  type DashItem,
  type DashProject,
  type DashboardData,
  type DashboardTab,
  type WeekEvent,
} from '@/features/core/server/dashboard-queries';

const KIND_TONE: Record<string, Tone> = {
  requests: 'attention',
  schedule_events: 'info',
  designs: 'caution',
  materials: 'neutral',
};

function SectionHead({ title, more }: { title: string; more?: { label: string; href: string } }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {more ? (
        <Link
          href={more.href}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[13px]"
          data-ui-key="dashboard-section-more"
        >
          {more.label}
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="bg-card text-muted-foreground rounded-xl border px-5 py-8 text-center text-sm">
      {children}
    </p>
  );
}

function Kpi({
  icon: Icon,
  tone,
  label,
  value,
  sub,
  href,
}: {
  icon: LucideIcon;
  tone: Tone;
  label: string;
  value: number | null;
  sub: string;
  href: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="bg-card hover:border-foreground/25 flex h-full flex-col rounded-xl border p-4 transition-colors md:p-5"
        data-ui-key="dashboard-kpi"
      >
        <span className="flex items-center gap-2.5">
          <span
            className={cn('grid size-8 shrink-0 place-items-center rounded-lg', toneClass(tone))}
          >
            <Icon aria-hidden className="size-4" />
          </span>
          <span className="text-[13px] leading-tight font-medium">{label}</span>
        </span>
        <span className="mt-4 text-3xl leading-none font-semibold tabular-nums">
          {value ?? '—'}
        </span>
        <span className="text-muted-foreground mt-2 text-xs">{sub}</span>
      </Link>
    </li>
  );
}

/** 요청 · 일정 · 도안을 한 목록으로 */
type TodoRow = { key: string; kind: string; title: string; meta: string; href: string };

function TodoList({ rows, empty }: { rows: TodoRow[]; empty: string }) {
  const t = useTranslations('projects.dashboard');
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="bg-card divide-y overflow-hidden rounded-xl border">
      {rows.map((r) => (
        <li key={r.key}>
          <Link
            href={r.href}
            className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3.5 md:gap-4 md:px-5"
            data-ui-key="dashboard-todo-open"
          >
            <span
              className={cn(
                'w-11 shrink-0 rounded-md py-1 text-center text-xs font-semibold',
                toneClass(KIND_TONE[r.kind] ?? 'neutral'),
              )}
            >
              {t(`kind.${r.kind}`)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">{r.title}</span>
              <span className="text-muted-foreground mt-0.5 block truncate text-[13px]">
                {r.meta}
              </span>
            </span>
            <ChevronRight aria-hidden className="text-muted-foreground size-4 shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ProjectCards({ projects, slug }: { projects: DashProject[]; slug: string }) {
  const t = useTranslations('projects.dashboard');
  if (projects.length === 0) return <Empty>{t('empty.projects')}</Empty>;
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {projects.map((p) => (
        <li key={p.id} className="min-w-0">
          <Link
            href={routes.app.project(slug, p.id)}
            className="bg-card hover:border-foreground/25 block h-full overflow-hidden rounded-xl border transition-colors"
            data-ui-key="dashboard-project-open"
          >
            <span className="bg-muted relative block aspect-[16/9]">
              {p.coverFileId ? (
                // eslint-disable-next-line @next/next/no-img-element -- /api/files 가 권한 확인 후 서명 주소로 보낸다
                <img
                  src={routes.file(p.coverFileId)}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-muted-foreground grid h-full place-items-center">
                  <ImageIcon aria-hidden className="size-6" />
                  <span className="sr-only">{t('noCover')}</span>
                </span>
              )}
              <span className="absolute top-3 left-3">
                <ProjectStatusBadge status={p.status} />
              </span>
            </span>
            <span className="block p-4 md:p-5">
              <span className="block truncate text-[15px] font-semibold">{p.name}</span>
              <span className="mt-3 flex items-center justify-between gap-2 text-[13px]">
                <span className="text-muted-foreground min-w-0 truncate">
                  {t('phase')} ·{' '}
                  <span className="text-foreground font-medium">
                    {p.currentPhase || t('phaseNone')}
                  </span>
                </span>
                {p.periodPct !== null ? (
                  <span className="font-semibold tabular-nums">{p.periodPct}%</span>
                ) : null}
              </span>
              {p.periodPct !== null ? (
                <span
                  role="img"
                  aria-label={t('periodProgress', { pct: p.periodPct })}
                  className="bg-muted mt-2 block h-1.5 overflow-hidden rounded-full"
                >
                  <span
                    className="bg-primary block h-full rounded-full"
                    style={{ width: `${p.periodPct}%` }}
                  />
                </span>
              ) : null}
              <span className="text-muted-foreground mt-3 flex items-center gap-1.5 text-[13px]">
                <Clock aria-hidden className="size-3.5 shrink-0" />
                <span className="truncate">
                  {p.next
                    ? t('next', {
                        title: p.next.title,
                        date: String(p.next.subtitleValues?.date ?? ''),
                      })
                    : t('nextNone')}
                </span>
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function WeekPanel({
  data,
  locale,
  full = false,
}: {
  data: DashboardData;
  locale: DateLocale;
  full?: boolean;
}) {
  const t = useTranslations('projects.dashboard');
  const tc = useTranslations('schedule');
  const when = (e: WeekEvent) => {
    const time = e.startTime ? formatCalendarTime(e.startTime, locale) : t('allDay');
    if (full) return `${formatCalendarDate(e.startDate, locale)} ${time}`;
    // 이번 주 안이라 요일만 (오늘은 '오늘')
    return e.startDate === data.today
      ? `${t('todayLabel')} ${time}`
      : `${tc(`view.weekdays.${weekdayOf(e.startDate)}`)} ${time}`;
  };

  // 오른쪽 칸: 오늘 이후 일정만 짧게 / 일정 탭: 이번 주 전체
  const list = full
    ? data.weekEvents
    : data.weekEvents.filter((e) => (e.endDate ?? e.startDate) >= data.today).slice(0, 4);
  const day = (ymd: string) => Number(ymd.slice(8, 10));
  const weekday = (i: number) => tc(`view.weekdays.${i}`);
  return (
    <div className="bg-card rounded-xl border p-4 md:p-5">
      <ul className="grid grid-cols-7 gap-1 text-center">
        {data.week.map((d, i) => {
          const isToday = d === data.today;
          const has = data.weekEvents.some((e) => isOnDay(e, d));
          return (
            <li
              key={d}
              aria-current={isToday ? 'date' : undefined}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg py-2',
                isToday && 'bg-primary text-primary-foreground',
              )}
            >
              <span
                className={cn(
                  'text-[11px]',
                  isToday ? 'text-primary-foreground/75' : 'text-muted-foreground',
                )}
              >
                {weekday(i)}
              </span>
              <span className="text-[15px] font-semibold tabular-nums">{day(d)}</span>
              <span
                aria-hidden
                className={cn(
                  'size-1.5 rounded-full',
                  has ? (isToday ? 'bg-primary-foreground' : 'bg-tone-info-fg') : 'bg-transparent',
                )}
              />
            </li>
          );
        })}
      </ul>
      {list.length === 0 ? (
        <p className="text-muted-foreground mt-4 border-t pt-4 text-sm">{t('empty.week')}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-1 border-t pt-3">
          {list.map((e) => (
            <li key={e.id}>
              <Link
                href={e.href}
                className="hover:bg-muted/50 -mx-2 flex gap-3 rounded-md px-2 py-1.5"
                data-ui-key="dashboard-event-open"
              >
                <span
                  className={cn(
                    'text-muted-foreground shrink-0 text-[13px] tabular-nums',
                    full ? 'w-36' : 'w-20',
                  )}
                >
                  {when(e)}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block truncate text-sm font-medium',
                      e.progress === 'done' && 'text-muted-foreground line-through',
                    )}
                  >
                    {e.title}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {e.projectName}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PhotoGrid({ photos, many = false }: { photos: DashItem[]; many?: boolean }) {
  const t = useTranslations('projects.dashboard');
  if (photos.length === 0) return <Empty>{t('empty.photos')}</Empty>;
  return (
    <div className="bg-card rounded-xl border p-3 md:p-4">
      <ul className={cn('grid grid-cols-3 gap-2', many && 'sm:grid-cols-4 lg:grid-cols-6')}>
        {photos.map((p) => (
          <li key={p.id} className="min-w-0">
            <Link
              href={p.href}
              className="bg-muted block aspect-square overflow-hidden rounded-lg"
              data-ui-key="dashboard-photo-open"
            >
              {p.thumbnailFileId ? (
                // eslint-disable-next-line @next/next/no-img-element -- /api/files 가 권한 확인 후 서명 주소로 보낸다
                <img
                  src={routes.file(p.thumbnailFileId)}
                  alt={`${p.projectName} · ${p.title}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="sr-only">{p.title}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-xs">
        <Camera aria-hidden className="size-3.5" />
        {t('photosFoot', { count: photos.length })}
      </p>
    </div>
  );
}

export function DashboardView({
  data,
  tab,
  slug,
  displayName,
}: {
  data: DashboardData;
  tab: DashboardTab;
  slug: string;
  displayName: string;
}) {
  const t = useTranslations('projects.dashboard');
  const tr = useTranslations('requests');
  const locale = (useLocale() === 'en' ? 'en' : 'ko') as DateLocale;
  const tabHref = (k: DashboardTab) =>
    k === 'all' ? routes.app.home(slug) : `${routes.app.home(slug)}?tab=${k}`;

  const todayEvents = data.weekEvents.filter(
    (e) => isOnDay(e, data.today) && e.progress !== 'done',
  );
  const requestRow = (r: DashItem): TodoRow => ({
    key: `r-${r.id}`,
    kind: 'requests',
    title: r.title,
    meta: t('requestMeta', {
      project: r.projectName,
      status: tr(`status.${String(r.subtitleValues?.status ?? 'open')}`),
    }),
    href: r.href,
  });
  const eventRow = (e: WeekEvent): TodoRow => ({
    key: `e-${e.id}`,
    kind: 'schedule_events',
    title: e.title,
    meta: t('eventMeta', {
      project: e.projectName,
      when: e.startTime ? formatCalendarTime(e.startTime, locale) : t('allDay'),
    }),
    href: e.href,
  });
  const designRow = (d: DashItem): TodoRow => ({
    key: `d-${d.id}`,
    kind: 'designs',
    title: d.title,
    meta: t('designMeta', { project: d.projectName }),
    href: d.href,
  });
  const todo: TodoRow[] = [
    ...todayEvents.map(eventRow),
    ...data.openRequests.map(requestRow),
    ...data.pendingDesigns.map(designRow),
  ];
  const doneThisWeek = data.weekEvents.filter((e) => e.progress === 'done').length;

  const kpis = (
    <ul className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      <Kpi
        icon={Hammer}
        tone="positive"
        label={t('kpi.active')}
        value={data.counts?.active ?? null}
        sub={t('kpi.activeSub', { count: data.counts?.planned ?? 0 })}
        href={tabHref('projects')}
      />
      <Kpi
        icon={MessageSquare}
        tone="attention"
        label={t('kpi.unanswered')}
        value={data.unanswered}
        sub={data.unanswered ? t('kpi.unansweredSub') : t('kpi.unansweredNone')}
        href={tabHref('requests')}
      />
      <Kpi
        icon={CalendarDays}
        tone="info"
        label={t('kpi.week')}
        value={data.weekEvents.length}
        sub={t('kpi.weekSub', {
          count: data.weekEvents.filter((e) => isOnDay(e, data.today)).length,
        })}
        href={tabHref('schedule')}
      />
      <Kpi
        icon={FileCheck2}
        tone="caution"
        label={t('kpi.pending')}
        value={data.pendingDesigns.length}
        sub={t('kpi.pendingSub')}
        href={tabHref('documents')}
      />
    </ul>
  );

  const greeting = (
    <div>
      <p className="text-muted-foreground text-sm">{formatCalendarDate(data.today, locale)}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight md:text-[22px]">
        {t('greeting', { name: displayName })}{' '}
        {todo.length > 0
          ? t.rich('todoCount', {
              count: todo.length,
              em: (c) => (
                <span className="decoration-tone-caution-fg underline decoration-[3px] underline-offset-[6px]">
                  {c}
                </span>
              ),
            })
          : t('todoNone')}
      </p>
    </div>
  );

  if (tab === 'projects')
    return (
      <section>
        <SectionHead
          title={t('section.projects')}
          more={{ label: t('more.projects'), href: routes.app.projects(slug) }}
        />
        <ProjectCards projects={data.projects} slug={slug} />
      </section>
    );
  if (tab === 'requests')
    return (
      <section>
        <SectionHead title={t('section.requests')} />
        <TodoList rows={data.openRequests.map(requestRow)} empty={t('empty.requests')} />
      </section>
    );
  if (tab === 'schedule')
    return (
      <section>
        <SectionHead
          title={t('section.schedule')}
          more={{ label: t('more.calendar'), href: routes.app.calendar(slug) }}
        />
        <WeekPanel data={data} locale={locale} full />
      </section>
    );
  if (tab === 'documents')
    return (
      <div className="flex flex-col gap-8">
        <section>
          <SectionHead title={t('section.pendingDesigns')} />
          <TodoList rows={data.pendingDesigns.map(designRow)} empty={t('empty.documents')} />
        </section>
        <section>
          <SectionHead title={t('section.recentDocuments')} />
          <TodoList
            rows={data.recentDocuments.map((d) => ({
              key: `${d.kind}-${d.id}`,
              kind: d.kind,
              title: d.title,
              meta: d.projectName,
              href: d.href,
            }))}
            empty={t('empty.documents')}
          />
        </section>
      </div>
    );
  if (tab === 'photos')
    return (
      <section>
        <SectionHead title={t('section.photos')} />
        <PhotoGrid photos={data.photos} many />
      </section>
    );

  return (
    <div className="flex flex-col gap-8">
      {greeting}
      {kpis}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-8">
          <section>
            <SectionHead
              title={t('section.todo')}
              more={
                todo.length > 5 ? { label: t('more.todo'), href: tabHref('requests') } : undefined
              }
            />
            <TodoList rows={todo.slice(0, 5)} empty={t('empty.todo')} />
          </section>
          <section>
            <SectionHead
              title={t('section.projects')}
              more={{ label: t('more.projects'), href: routes.app.projects(slug) }}
            />
            <ProjectCards projects={data.projects.slice(0, 4)} slug={slug} />
          </section>
        </div>
        <div className="flex min-w-0 flex-col gap-8">
          <section>
            <SectionHead
              title={t('section.week')}
              more={{ label: t('more.calendar'), href: routes.app.calendar(slug) }}
            />
            <WeekPanel data={data} locale={locale} />
          </section>
          <section>
            <SectionHead
              title={t('section.photos')}
              more={
                data.photos.length
                  ? { label: t('more.photos'), href: tabHref('photos') }
                  : undefined
              }
            />
            <PhotoGrid photos={data.photos} />
          </section>
          {doneThisWeek > 0 ? (
            <p className="bg-card flex items-center gap-3 rounded-xl border p-4 text-sm md:p-5">
              <CheckCircle2 aria-hidden className="text-tone-positive-fg size-5 shrink-0" />
              <span>
                {t.rich('doneThisWeek', {
                  count: doneThisWeek,
                  strong: (c) => <strong className="font-semibold">{c}</strong>,
                })}
              </span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

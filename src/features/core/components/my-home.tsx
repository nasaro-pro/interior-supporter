// 마이홈 (CL-03 위쪽) — 계약 고객이 로그인하면 바로 보는 '우리 집' 한 화면
//  ① 공사 진행: 지금 공정 · 며칠째 · 완공까지 남은 날 · 진행 막대
//  ② 최근 사진 3장: 사진마다 내 댓글·디자이너 답글 최근 2개 + 그 자리에서 댓글 쓰기 (사진 상세로 이동하지 않아도 됨)
// 데이터는 원본 그대로: 사진은 photos summaryProvider(고객은 공개분만, RLS), 댓글은 photos 의 listPhotoComments (자기 대화만)
// 담당자의 '고객 화면 미리보기'에서는 입력칸을 그리지 않는다 (integration.ts ProjectAccess.preview)
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { ChevronRight, MessageCircle } from 'lucide-react';
import type { ProjectAccess, SummaryItem } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { formatDateTime, todayKst, type DateLocale } from '@/shared/lib/dates';
import { logger } from '@/shared/lib/logger';
import { cn } from '@/shared/lib/utils';
import { PeriodText } from '@/shared/ui/date-text';
import { summaryProvider as photosSummary } from '@/features/photos/server/summary';
import { listPhotoComments, type PhotoCommentThread } from '@/features/photos/server/queries';
import { PhotoCommentForm } from '@/features/photos/components/PhotoCommentForm';
import { constructionProgress } from '../my-home';
import type { ProjectDetail } from '../types';
import { Panel } from './summary-blocks';

/** ① 공사 진행 */
export async function MyHomeProgress({
  project,
}: {
  project: Pick<ProjectDetail, 'currentPhase' | 'startDate' | 'endDate' | 'status'>;
}) {
  const t = await getTranslations('projects.myHome');
  const pr = constructionProgress(project, todayKst());
  const line =
    pr.state === 'during'
      ? t('progress.during', { day: pr.dayNo ?? 0, left: pr.daysLeft ?? 0 })
      : pr.state === 'before'
        ? t('progress.before', { days: pr.daysToStart ?? 0 })
        : pr.state === 'after'
          ? t('progress.after')
          : pr.state === 'done'
            ? t('progress.done')
            : t('progress.unknown');
  return (
    <Panel title={t('progressTitle')}>
      <div className="flex flex-col gap-3" data-ui-key="my-home-progress" data-state={pr.state}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-xl font-semibold">{project.currentPhase || t('phaseEmpty')}</p>
          <p className="text-muted-foreground text-meta">
            <PeriodText
              from={project.startDate}
              until={project.endDate}
              emptyLabel={t('noPeriod')}
            />
          </p>
        </div>
        {pr.percent !== null ? (
          <div
            role="progressbar"
            aria-label={t('progressTitle')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pr.percent}
            aria-valuetext={line}
            className="bg-muted h-2.5 overflow-hidden rounded-full"
          >
            <div className="bg-primary h-full rounded-full" style={{ width: `${pr.percent}%` }} />
          </div>
        ) : null}
        <p className="text-sm" data-numeric>
          {line}
        </p>
      </div>
    </Panel>
  );
}

/** ② 최근 사진 + 바로 댓글 */
export async function MyHomePhotoFeed({
  access,
  userId,
}: {
  access: ProjectAccess;
  userId: string;
}) {
  const t = await getTranslations('projects.myHome');
  const tp = await getTranslations('photos.comments');
  const locale = ((await getLocale()) === 'en' ? 'en' : 'ko') as DateLocale;
  const projectId = access.projectId;

  let photos: SummaryItem[] = [];
  let failed = false;
  try {
    photos = await photosSummary.recent(projectId, access, 3);
  } catch (e) {
    failed = true;
    logger.warn('myhome.photos.failed', {
      projectId,
      code: e instanceof Error ? e.name : 'unknown',
    });
  }
  const threads = await Promise.all(
    photos.map((p) =>
      listPhotoComments(p.id, access, userId).catch(() => [] as PhotoCommentThread[]),
    ),
  );

  return (
    <Panel
      title={t('photosTitle')}
      action={
        <Link
          href={routes.portal.project(projectId, 'photos')}
          className="text-muted-foreground hover:text-foreground text-meta inline-flex items-center gap-0.5"
          data-ui-key="my-home-photos-all"
        >
          {t('photosAll')}
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      }
    >
      {failed ? (
        <p className="text-muted-foreground py-2 text-sm">{t('photosFailed')}</p>
      ) : photos.length === 0 ? (
        <p className="text-muted-foreground py-2 text-sm">{t('photosEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-5" data-ui-key="my-home-photo-feed">
          {photos.map((p, i) => {
            const comments = (threads[i] ?? []).flatMap((th) => th.comments);
            const recent = comments.slice(-2);
            return (
              <li
                key={p.id}
                data-key={p.id}
                className="flex flex-col gap-3 border-b pb-5 last:border-0 last:pb-0"
              >
                <Link
                  href={p.href}
                  className="focus-visible:ring-ring/50 grid gap-3 rounded-md outline-none focus-visible:ring-3 sm:grid-cols-[200px_1fr]"
                  data-ui-key="my-home-photo-open"
                >
                  {p.thumbnailFileId ? (
                    // eslint-disable-next-line @next/next/no-img-element -- /api/files 가 권한 확인 후 서명 주소로 보낸다
                    <img
                      src={routes.file(p.thumbnailFileId)}
                      alt=""
                      loading="lazy"
                      className="bg-muted aspect-[4/3] w-full rounded-md object-cover"
                    />
                  ) : null}
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="font-medium">{p.title}</span>
                    <time className="text-muted-foreground text-meta" dateTime={p.at} data-numeric>
                      {formatDateTime(p.at, locale)}
                    </time>
                    <span className="text-muted-foreground text-meta mt-auto inline-flex items-center gap-1">
                      <MessageCircle aria-hidden className="size-3.5" />
                      {t('commentCount', { n: comments.length })}
                    </span>
                  </span>
                </Link>
                {recent.length ? (
                  <ol className="flex flex-col gap-2" aria-label={t('recentComments')}>
                    {recent.map((c) => (
                      <li
                        key={c.id}
                        data-key={c.id}
                        className={cn('flex', c.byOwner ? 'justify-end' : 'justify-start')}
                      >
                        <div
                          className={cn(
                            'flex max-w-[88%] flex-col gap-0.5 rounded-2xl border px-3 py-2',
                            c.byOwner
                              ? 'bg-primary/10 border-primary/30 rounded-br-sm'
                              : 'bg-card rounded-bl-sm',
                          )}
                        >
                          <span className="text-meta text-muted-foreground">
                            {c.byOwner ? t('me') : tp('designer')}
                          </span>
                          <p className="text-sm break-words whitespace-pre-wrap">{c.body}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : null}
                {access.preview ? null : <PhotoCommentForm projectId={projectId} photoId={p.id} />}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

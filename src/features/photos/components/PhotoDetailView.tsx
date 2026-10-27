// 사진 상세 본문 — 사진·공정·촬영일·등록 시각·설명·업로더·공개 + 원본 다운로드 (REQ-212, REQ-222)
// 헤더(제목·배지) → 본문(사진) | 사이드(정보·다운로드·관리) — 02 문서 5장 상세 규칙
import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Archive, ArrowLeft, Download } from 'lucide-react';
import { routes } from '@/shared/contracts/routes';
import { formatCalendarDate, formatDateTime, type DateLocale } from '@/shared/lib/dates';
import { cn } from '@/shared/lib/utils';
import { buttonVariants } from '@/shared/ui/button';
import { ButtonLink } from '@/shared/ui/button-link';
import { Notice } from '@/shared/ui/notice';
import { Section } from '@/shared/ui/section';
import { ToneBadge } from '@/shared/ui/tone-badge';
import { uploaderLabel } from '../lib/uploader-label';
import type { PhotoItem } from '../types';
import { PhotoImage } from './PhotoImage';
import { PhotoVisibilityBadge } from './PhotoVisibilityBadge';
import { PhotoComments } from './PhotoComments';

export function PhotoDetailView({
  photo,
  listHref,
  showVisibility,
  showUploader,
  headingLevel = 'h2',
  actions,
}: {
  photo: PhotoItem;
  listHref: string;
  showVisibility: boolean;
  showUploader: boolean;
  /** 프로젝트 헤더(h1) 아래면 h2, 시공팀 영역(FW-02)처럼 단독 화면이면 h1 */
  headingLevel?: 'h1' | 'h2';
  actions?: ReactNode;
}) {
  const t = useTranslations('photos');
  const tc = useTranslations('common');
  const locale = useLocale() as DateLocale;
  const phase = t(`phase.${photo.phase}`);
  const Heading = headingLevel;
  return (
    <>
      <header className="flex flex-col gap-3">
        <div>
          <ButtonLink href={listHref} variant="ghost" size="sm" data-ui-key="photo-detail-back">
            <ArrowLeft aria-hidden />
            {t('screen.list')}
          </ButtonLink>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Heading className="min-w-0 text-xl font-semibold tracking-tight">
            {t('screen.detail')} · {phase}
          </Heading>
          <div className="flex flex-wrap items-center gap-2">
            {photo.archived ? (
              <ToneBadge tone="neutral" icon={Archive}>
                {tc('filter.archived')}
              </ToneBadge>
            ) : null}
            {showVisibility ? <PhotoVisibilityBadge isPublic={photo.isPublic} /> : null}
          </div>
        </div>
        {photo.archived ? <Notice tone="neutral">{tc('state.archivedItem')}</Notice> : null}
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <figure className="bg-card flex min-w-0 flex-col gap-2 rounded-lg border p-2 sm:p-4">
          <PhotoImage
            fileId={photo.fileId}
            alt={t('detail.imageAlt', { phase })}
            eager
            className="max-h-[70svh] w-full rounded-md object-contain"
          />
          {!photo.thumbFileId ? (
            <figcaption className="text-muted-foreground text-meta">
              {t('detail.thumbFailed')}
            </figcaption>
          ) : null}
        </figure>
        <aside className="flex min-w-0 flex-col gap-4">
          <Section title={t('detail.info')} as="h3" variant="card">
            <dl className="flex flex-col gap-3 text-sm">
              <Meta label={t('field.phase')}>{phase}</Meta>
              <Meta label={t('field.capturedOn')}>
                {photo.capturedOn ? (
                  <time dateTime={photo.capturedOn} data-numeric>
                    {formatCalendarDate(photo.capturedOn, locale)}
                  </time>
                ) : (
                  t('list.noDate')
                )}
              </Meta>
              <Meta label={t('field.uploadedAt')}>
                <time dateTime={photo.createdAt} data-numeric>
                  {formatDateTime(photo.createdAt, locale)}
                </time>
              </Meta>
              {showUploader ? (
                <Meta label={t('field.uploader')}>{uploaderLabel(t, photo)}</Meta>
              ) : null}
              <Meta label={t('field.description')}>
                <span className="break-words whitespace-pre-wrap">
                  {photo.description || t('detail.noDescription')}
                </span>
              </Meta>
            </dl>
            {/* 원본 다운로드는 /api/files 라우트(권한 재검사 후 302) — next/link 가 아닌 일반 링크 */}
            <a
              href={routes.file(photo.fileId, { download: true })}
              className={cn(buttonVariants({ variant: 'outline' }), 'self-start')}
              data-ui-key="photo-download-original"
            >
              <Download aria-hidden />
              {t('action.downloadOriginal')}
            </a>
          </Section>
          {actions ? (
            <Section title={t('detail.manage')} as="h3" variant="card">
              {actions}
            </Section>
          ) : null}
          {/* D-34 · CU-07: 댓글 (시공팀 화면에는 그리지 않음) */}
          <PhotoComments
            projectId={photo.projectId}
            photoId={photo.id}
            isPublic={photo.isPublic}
            archived={photo.archived}
          />
        </aside>
      </div>
    </>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
      <dt className="text-muted-foreground text-meta">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

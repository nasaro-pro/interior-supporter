// D-34 · CU-07 사진 댓글 (서버 컴포넌트) — 사진 상세 오른쪽 칸
// 고객: 자기 대화 + 댓글 입력(공개 사진만) / 디자이너: 고객별 대화 + 답글 / 시공팀: 그리지 않음
import { getLocale, getTranslations } from 'next-intl/server';
import { getAccessContext, requireProjectAccess } from '@/features/core';
import { formatDateTime, type DateLocale } from '@/shared/lib/dates';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/ui/section';
import { listPhotoComments } from '../server/queries';
import { PhotoCommentForm } from './PhotoCommentForm';

export async function PhotoComments({
  projectId,
  photoId,
  isPublic,
  archived,
}: {
  projectId: string;
  photoId: string;
  isPublic: boolean;
  archived: boolean;
}) {
  const viewer = await requireProjectAccess(projectId, ['editor', 'customer', 'field']);
  if (viewer.as === 'field') return null; // 시공팀은 댓글을 보지 않는다 (POL-005)
  const t = await getTranslations('photos');
  const locale = ((await getLocale()) === 'en' ? 'en' : 'ko') as DateLocale;
  const ctx = await getAccessContext();
  const threads = await listPhotoComments(photoId, viewer, ctx.userId);
  const editor = viewer.as === 'editor';
  // 담당자의 고객 화면 미리보기는 읽기 전용 (댓글 입력 없음)
  const open = isPublic && !archived && !viewer.preview;

  return (
    <Section title={t('comments.title')} as="h3" variant="card">
      <div className="flex flex-col gap-4" data-ui-key="photo-comments">
        {editor && !isPublic ? (
          <p className="text-muted-foreground text-meta">{t('comments.privateHint')}</p>
        ) : null}
        {threads.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {editor ? t('comments.emptyEditor') : t('comments.emptyCustomer')}
          </p>
        ) : (
          threads.map((th) => (
            <section
              key={th.ownerId}
              data-key={th.ownerId}
              className="flex flex-col gap-2 border-b pb-3 last:border-0"
              aria-label={
                editor ? t('comments.threadOf', { name: th.ownerName ?? '—' }) : undefined
              }
            >
              {editor ? <p className="text-meta font-medium">{th.ownerName ?? '—'}</p> : null}
              <ol className="flex flex-col gap-2">
                {th.comments.map((c) => {
                  const mine = editor ? !c.byOwner : c.byOwner;
                  return (
                    <li
                      key={c.id}
                      data-key={c.id}
                      data-side={mine ? 'mine' : 'theirs'}
                      className={cn('flex', mine ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'flex max-w-[88%] flex-col gap-1 rounded-2xl border px-3 py-2',
                          mine
                            ? 'bg-primary/10 border-primary/30 rounded-br-sm'
                            : 'bg-card rounded-bl-sm',
                        )}
                      >
                        <span className="text-meta text-muted-foreground">
                          {c.byOwner ? (c.authorName ?? '—') : t('comments.designer')} ·{' '}
                          <time dateTime={c.createdAt} data-numeric>
                            {formatDateTime(c.createdAt, locale)}
                          </time>
                        </span>
                        <p className="text-sm break-words whitespace-pre-wrap">{c.body}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {editor && open ? (
                <PhotoCommentForm
                  projectId={projectId}
                  photoId={photoId}
                  threadOwner={th.ownerId}
                />
              ) : null}
            </section>
          ))
        )}
        {!editor && open ? <PhotoCommentForm projectId={projectId} photoId={photoId} /> : null}
      </div>
    </Section>
  );
}

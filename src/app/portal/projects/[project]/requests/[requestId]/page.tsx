// CL-16 요청 상세 (D4) — 원문·정정·답변 보기, 정정 추가(작성자 본인). 원문 수정 UI 없음 (REQ-202, REQ-203)
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getAccessContext, requireProjectAccess } from '@/features/core';
import { RequestDetailHeader } from '@/features/requests/components/RequestDetailHeader';
import { RequestEntryForm } from '@/features/requests/components/RequestEntryForm';
import { RequestThread } from '@/features/requests/components/RequestThread';
import { isUuid } from '@/features/requests/lib/list-params';
import { getRequestDetail } from '@/features/requests/server/queries';
import { routes } from '@/shared/contracts/routes';
import { Notice } from '@/shared/ui/notice';
import { Section } from '@/shared/ui/section';

type Props = { params: Promise<{ project: string; requestId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('requests');
  return { title: t('screen.detail') };
}

export default async function PortalRequestDetailPage({ params }: Props) {
  const { project, requestId } = await params;
  const access = await requireProjectAccess(project, ['customer']);
  if (!isUuid(requestId)) notFound();
  // RLS(row_visible_requests) + 쿼리 author_id 이중 검증: 남의 요청은 null → 404 (C-T02, C-01)
  const ctx = await getAccessContext();
  const detail = await getRequestDetail(project, requestId, access, ctx.userId);
  if (!detail) notFound();
  const t = await getTranslations();
  const hasReply = detail.entries.some((e) => e.kind === 'reply');

  return (
    <main data-screen-id="CL-16" className="flex flex-col gap-6">
      <RequestDetailHeader detail={detail} listHref={routes.portal.project(project, 'requests')} />
      <Section
        title={t('requests.thread.label')}
        as="h3"
        meta={t('common.list.count', { count: detail.entries.length })}
      >
        {/* CU-06: 대화형 — 고객 본인 글이 오른쪽 */}
        <RequestThread entries={detail.entries} perspective="customer" />
        {!hasReply ? (
          <p className="text-muted-foreground text-sm">{t('requests.detail.noReplies')}</p>
        ) : null}
        {detail.archivedAt ? (
          <Notice tone="neutral">{t('requests.detail.archivedNoCorrection')}</Notice>
        ) : (
          <div className="bg-card rounded-lg border p-4">
            <RequestEntryForm kind="correction" projectId={project} requestId={requestId} />
          </div>
        )}
      </Section>
    </main>
  );
}

// PM-16 요청 상세 (D4) — 원문·정정·답변, 답변 등록, 처리 상태 변경, 보관 (REQ-202, REQ-204, REQ-205)
// 헤더(제목·상태 배지) → 메타 → 본문(스레드·답변) | 사이드(관리) — 02 문서 5장 상세 규칙
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getAccessContext, requireProjectAccess } from '@/features/core';
import { RequestArchiveButton } from '@/features/requests/components/RequestArchiveButton';
import { RequestDetailHeader } from '@/features/requests/components/RequestDetailHeader';
import { RequestEntryForm } from '@/features/requests/components/RequestEntryForm';
import { RequestStatusSelect } from '@/features/requests/components/RequestStatusSelect';
import { RequestThread } from '@/features/requests/components/RequestThread';
import { isUuid } from '@/features/requests/lib/list-params';
import { getRequestDetail } from '@/features/requests/server/queries';
import { routes } from '@/shared/contracts/routes';
import { Section } from '@/shared/ui/section';

type Props = { params: Promise<{ company: string; project: string; requestId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('requests');
  return { title: t('screen.detail') };
}

export default async function PmRequestDetailPage({ params }: Props) {
  const { company, project, requestId } = await params;
  const access = await requireProjectAccess(project, ['editor']);
  if (access.companySlug !== company || !isUuid(requestId)) notFound();
  const ctx = await getAccessContext();
  const detail = await getRequestDetail(project, requestId, access, ctx.userId);
  if (!detail) notFound(); // 상세를 그리기 전에 존재 숨김
  const t = await getTranslations();
  const hasReply = detail.entries.some((e) => e.kind === 'reply');

  return (
    <main data-screen-id="PM-16" className="flex flex-col gap-6">
      <RequestDetailHeader
        detail={detail}
        listHref={routes.app.project(company, project, 'requests')}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Section
          title={t('requests.thread.label')}
          as="h3"
          meta={t('common.list.count', { count: detail.entries.length })}
        >
          <RequestThread entries={detail.entries} />
          {!hasReply ? (
            <p className="text-muted-foreground text-sm">{t('requests.detail.noReplies')}</p>
          ) : null}
          {!detail.archivedAt ? (
            <div className="bg-card rounded-lg border p-4">
              <RequestEntryForm kind="reply" projectId={project} requestId={requestId} />
            </div>
          ) : null}
        </Section>
        <aside className="min-w-0">
          <Section title={t('requests.detail.manage')} as="h3" variant="card">
            {!detail.archivedAt ? (
              <RequestStatusSelect
                key={`${detail.status}-${detail.version}`}
                projectId={project}
                requestId={requestId}
                status={detail.status}
                version={detail.version}
              />
            ) : null}
            <RequestArchiveButton
              key={`archive-${detail.version}`}
              projectId={project}
              requestId={requestId}
              version={detail.version}
              archived={detail.archivedAt !== null}
            />
          </Section>
        </aside>
      </div>
    </main>
  );
}

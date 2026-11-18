// src/app/portal/projects/(list)/page.tsx (A · REQ-015) — CL-01 내 프로젝트
// 2026-11: 목록 화면 없이 가장 최근에 바뀐 우리 집(프로젝트) 홈으로 바로 보낸다.
// 집이 여러 채인 고객은 프로젝트 머리의 '다른 집' 칩으로 옮겨 다닌다 (PortalProjectHeader).
// 열 수 있는 집이 없거나 조회에 실패했을 때만 이 화면이 보인다.
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getAccessContext } from '@/features/core';
import { listPortalProjects } from '@/features/core/server/project-queries';
import { routes } from '@/shared/contracts/routes';
import { ButtonLink } from '@/shared/ui/button-link';
import { PageHeader } from '@/shared/ui/page-parts';
import { EmptyState, ErrorState } from '@/shared/ui/states';

export default async function MyProjectsPage() {
  const ctx = await getAccessContext();
  const ids = [
    ...new Set(ctx.participations.filter((p) => p.role === 'customer').map((p) => p.projectId)),
  ];
  const groups = await listPortalProjects(ids);
  // 조회가 updated_at 내림차순이라 첫 묶음의 첫 집이 가장 최근에 바뀐 집
  const latest = groups?.[0]?.projects[0];
  if (latest) redirect(routes.portal.project(latest.id, 'home'));

  const t = await getTranslations();
  return (
    <main data-screen-id="CL-01" className="flex flex-col gap-6">
      <PageHeader title={t('projects.screen.myProjects')} />
      {groups === null ? (
        <ErrorState
          action={
            <ButtonLink
              href={routes.portal.projects()}
              data-ui-key="my-projects-retry"
              variant="outline"
            >
              {t('common.action.retry')}
            </ButtonLink>
          }
        />
      ) : (
        <EmptyState title={t('projects.myProjects.empty')} />
      )}
    </main>
  );
}

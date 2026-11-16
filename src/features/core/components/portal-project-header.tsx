// src/features/core/components/portal-project-header.tsx (A) — 고객 프로젝트 머리 (2026-11 새 디자인, 메인페이지와 같은 짜임)
// 작은 영문 이름표 → 큰 공사 이름 + 진행 상태 → 주소. 공사 기간 · 현재 공정은 홈의 '공사 진행' 칸 한 곳에만 둔다 (중복 제거)
import Link from 'next/link';
import { ChevronLeft, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectHeaderData } from '@/shared/contracts/integration';
import { cn } from '@/shared/lib/utils';
import { CUSTOMER_TITLE_CLASS } from '../customer-style';
import { ProjectStatusBadge } from './project-badges';

export const EYEBROW =
  'text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase';

export function PortalProjectHeader({
  project,
  projectsHref,
}: {
  project: ProjectHeaderData;
  /** 집이 여러 채인 고객만 — '내 프로젝트'로 돌아가는 작은 링크 */
  projectsHref?: string;
}) {
  const t = useTranslations();
  return (
    <div className="pt-7 md:pt-12">
      {projectsHref ? (
        <Link
          href={projectsHref}
          className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-0.5 text-sm"
          data-ui-key="portal-projects-back"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {t('projects.screen.myProjects')}
        </Link>
      ) : null}
      <p className={EYEBROW}>{t('projects.portalHeader.eyebrow')}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1
          className={cn(
            'max-w-full text-[26px] leading-tight tracking-tight wrap-anywhere md:text-4xl',
            CUSTOMER_TITLE_CLASS,
          )}
        >
          {project.name}
        </h1>
        <ProjectStatusBadge status={project.status} />
      </div>
      {project.siteAddress ? (
        <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-sm wrap-anywhere">
          <MapPin aria-hidden className="size-3.5 shrink-0" />
          {project.siteAddress}
        </p>
      ) : null}
    </div>
  );
}

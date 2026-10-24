// src/features/core/components/project-badges.tsx (A) — 프로젝트 상태·공개 배지
import { useTranslations } from 'next-intl';
import { StatusBadge } from '@/shared/ui/status-badge';
import type { ProjectStatus } from '@/shared/contracts/domain';

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const t = useTranslations('projects');
  return <StatusBadge status={`project_${status}`} label={t(`status.${status}`)} />;
}

export function VisibilityBadge({ isPublic }: { isPublic: boolean }) {
  const t = useTranslations('common');
  return (
    <StatusBadge
      status={isPublic ? 'public' : 'private'}
      label={isPublic ? t('visibility.public') : t('visibility.private')}
    />
  );
}

// src/features/core/components/customer-preview.tsx (A) — 담당자의 고객 화면 미리보기 진입 버튼 · 미리보기 안내 띠
// 진입 · 종료는 쿠키를 다루는 라우트 핸들러라 next/link 대신 일반 <a> 로 이동한다 (클라이언트 이동 · prefetch 금지)
import { useTranslations } from 'next-intl';
import { Eye, LogOut } from 'lucide-react';
import { buttonVariants } from '@/shared/ui/button';
import { routes } from '@/shared/contracts/routes';
import { cn } from '@/shared/lib/utils';

/** 담당자 프로젝트 헤더의 [고객 화면 미리보기] */
export function CustomerPreviewButton({
  companySlug,
  projectId,
}: {
  companySlug: string;
  projectId: string;
}) {
  const t = useTranslations('projects.customerPreview');
  return (
    <a
      href={routes.app.customerPreview(companySlug, projectId)}
      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}
      data-ui-key="customer-preview-open"
    >
      <Eye aria-hidden />
      {t('open')}
    </a>
  );
}

/** 고객 화면 위쪽 띠 — 미리보기 중 · 읽기 전용 · 끝내기 */
export function CustomerPreviewBanner({
  projectId,
  isPublic,
}: {
  projectId: string;
  isPublic: boolean;
}) {
  const t = useTranslations('projects.customerPreview');
  return (
    <div
      role="status"
      data-ui-key="customer-preview-banner"
      className="bg-tone-info-bg text-tone-info-fg border-tone-info-fg/30 sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border px-3 py-2 text-sm"
    >
      <Eye aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <b className="font-semibold">{t('bannerTitle')}</b> · {t('bannerBody')}
        {isPublic ? null : <span className="block">{t('notPublic')}</span>}
      </span>
      <a
        href={routes.portal.previewExit(projectId)}
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'bg-background')}
        data-ui-key="customer-preview-exit"
      >
        <LogOut aria-hidden />
        {t('exit')}
      </a>
    </div>
  );
}

// PM-19 / CL-19 견적 상세 (D4, REQ-132·133) — 선택 버전(?v=N)의 PDF 미리보기·다운로드·변경 설명·공개 시각
// 견적에는 확정·승인 버튼이 없다. 다운로드는 선택 버전의 file_id 로만 (B-T09)
import { getLocale, getTranslations } from 'next-intl/server';
import type { ProjectAccess } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { formatDateTime } from '@/shared/lib/dates';
import { Download } from 'lucide-react';
import { buttonVariants } from '@/shared/ui/button';
import { ArchiveToggle, PublishToggle } from '@/shared/ui/record-actions';
import { Notice } from '@/shared/ui/notice';
import { EmptyState } from '@/shared/ui/states';
import { FileDownloadLink, sizeParts } from '@/features/files';
import { ArchivedBadge, VisibilityBadge } from '@/features/designs/components/StateBadges';
import { setEstimateArchived, setEstimateVersionPublic } from '@/features/estimates/server/actions';
import { EstimateFormSheet } from '@/features/estimates/components/EstimateFormSheet';
import { EstimateVersionPicker } from '@/features/estimates/components/EstimateVersionPicker';
import { PdfPreview } from '@/features/estimates/components/PdfPreview';
import type { EstimateDetail } from '@/features/estimates/types';
import { canManageEstimates } from '@/features/estimates/server/permission';

export async function EstimateDetailView({
  estimate,
  viewer,
}: {
  estimate: EstimateDetail;
  viewer: ProjectAccess;
}) {
  const t = await getTranslations('estimates');
  const tc = await getTranslations('common');
  const tf = await getTranslations('files');
  const locale = (await getLocale()) === 'en' ? 'en' : 'ko';
  const editor = viewer.as === 'editor';
  // D-37: 담당자(pm)는 보기만 — 새 버전 · 공개 · 보관은 업체관리자(owner · manager)
  const manager = editor && (await canManageEstimates(viewer.companyId));
  const v = estimate.selected;
  const hrefFor = (no: number) =>
    editor
      ? routes.app.estimate(viewer.companySlug, viewer.projectId, estimate.id, no)
      : routes.portal.estimate(viewer.projectId, estimate.id, no);
  const size = v?.sizeBytes ? sizeParts(v.sizeBytes) : null;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold break-words">{estimate.title}</h2>
          {estimate.archivedAt ? <ArchivedBadge label={tc('filter.archived')} /> : null}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {estimate.versions.length > 0 && v ? (
            <EstimateVersionPicker
              versions={estimate.versions.map((x) => ({
                versionNo: x.versionNo,
                versionLabel: x.versionLabel,
                isPublic: x.isPublic,
              }))}
              selectedNo={v.versionNo}
              hrefs={Object.fromEntries(
                estimate.versions.map((x) => [x.versionNo, hrefFor(x.versionNo)]),
              )}
            />
          ) : null}
          {manager && !estimate.archivedAt ? (
            <EstimateFormSheet
              mode="newVersion"
              projectId={viewer.projectId}
              companyId={viewer.companyId}
              companySlug={viewer.companySlug}
              estimateId={estimate.id}
            />
          ) : null}
          {manager ? (
            // B-05: 보관·복원 (보관 중에는 새 버전·공개 전환을 숨기고 읽기 전용)
            <ArchiveToggle
              action={setEstimateArchived}
              payload={{
                projectId: viewer.projectId,
                id: estimate.id,
                baseVersion: estimate.version,
              }}
              archived={!!estimate.archivedAt}
              uiKey="estimate-archive"
            />
          ) : null}
        </div>
        {editor && estimate.archivedAt ? (
          <Notice tone="neutral">{tc('state.archivedItem')}</Notice>
        ) : null}
        {editor && !manager ? (
          <Notice tone="neutral" uiKey="estimate-view-only">
            {t('detail.viewOnly')}
          </Notice>
        ) : null}
      </header>

      {!v ? (
        <EmptyState title={t('detail.noVersion')} />
      ) : (
        <>
          <section
            aria-label={t('field.version', { no: v.versionNo })}
            className="flex min-w-0 flex-col gap-2 text-sm"
            data-key={v.id}
          >
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold break-words">
                {t('field.version', { no: v.versionNo })} · {v.versionLabel}
              </h2>
              {editor ? (
                <VisibilityBadge
                  isPublic={v.isPublic}
                  label={v.isPublic ? tc('visibility.public') : tc('visibility.private')}
                />
              ) : null}
            </div>
            {editor && !v.isPublic ? (
              <Notice tone="neutral">{t('detail.privateVersion')}</Notice>
            ) : null}
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">{t('field.changeNote')}</dt>
              <dd className="break-words whitespace-pre-wrap">{v.changeNote}</dd>
              <dt className="text-muted-foreground">{t('field.publishedAt')}</dt>
              <dd data-numeric>{v.publishedAt ? formatDateTime(v.publishedAt, locale) : '—'}</dd>
              <dt className="text-muted-foreground">{tc('field.createdAt')}</dt>
              <dd data-numeric>{formatDateTime(v.createdAt, locale)}</dd>
              {v.fileName ? (
                <>
                  <dt className="text-muted-foreground">{t('field.file')}</dt>
                  <dd className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="min-w-0 truncate">{v.fileName}</span>
                    {size ? (
                      <span className="text-meta text-muted-foreground">
                        {tf(`size.${size.unit}`, { value: size.value })}
                      </span>
                    ) : null}
                  </dd>
                </>
              ) : null}
            </dl>
            <div className="flex flex-wrap items-center gap-2">
              <FileDownloadLink
                fileId={v.fileId}
                uiKey="estimate-download"
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <Download aria-hidden />
                {t('action.download')}
              </FileDownloadLink>
              {manager && !estimate.archivedAt ? (
                <PublishToggle
                  action={setEstimateVersionPublic}
                  payload={{
                    projectId: viewer.projectId,
                    estimateId: estimate.id,
                    id: v.id,
                    baseVersion: v.version,
                  }}
                  isPublic={v.isPublic}
                  confirm={{ title: t('publish.title'), body: t('publish.body') }}
                  publishedToast={t('toast.published', { label: v.versionLabel })}
                  uiKey="estimate-version-publish"
                />
              ) : null}
            </div>
            <p className="text-meta text-muted-foreground">{t('detail.versionMatch')}</p>
          </section>
          <PdfPreview
            key={v.fileId}
            fileId={v.fileId}
            title={`${estimate.title} ${v.versionLabel}`}
          />
        </>
      )}
    </div>
  );
}

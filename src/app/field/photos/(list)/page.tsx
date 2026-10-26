// FW-01 현장 사진 (D1) + FW-03 업로드(?upload=1, 화면 상태) — REQ-220, REQ-221
// 오늘 작업·내 현장 목록·공정일지 없음 (제외 범위). 현장 선택은 필터.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { MapPin } from 'lucide-react';
import { getAccessContext, requireProjectAccess } from '@/features/core';
import { getFieldSite } from '@/features/field/server/queries';
import { PhotoFilters } from '@/features/photos/components/PhotoFilters';
import { PhotoGrid } from '@/features/photos/components/PhotoGrid';
import { PhotoUploadSheet } from '@/features/photos/components/PhotoUploadSheet';
import { SiteSelector } from '@/features/photos/components/SiteSelector';
import {
  hasPhotoFilter,
  parsePhotoListParams,
  photoListHref,
} from '@/features/photos/lib/list-params';
import { pickSite } from '@/features/photos/lib/site';
import { listFieldSites } from '@/features/photos/server/field-sites';
import { listPhotoUploaders, listPhotos } from '@/features/photos/server/queries';
import { firstParam, isUuid, type SearchParams } from '@/features/requests/lib/list-params';
import { PAGE_SIZE } from '@/shared/contracts/domain';
import { routes } from '@/shared/contracts/routes';
import { Button } from '@/shared/ui/button';
import { LoadMore, PageHeader } from '@/shared/ui/page-parts';
import { EmptyState, FilterEmptyState } from '@/shared/ui/states';

type Props = { searchParams: Promise<SearchParams> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('photos');
  return { title: t('screen.field') };
}

export default async function FieldPhotosPage({ searchParams }: Props) {
  const ctx = await getAccessContext();
  const sp = await searchParams;
  const requested = firstParam(sp, 'project') ?? null;
  if (requested !== null && !isUuid(requested)) notFound();
  const sites = await listFieldSites(ctx);
  const pick = pickSite(sites, requested);
  // 배정되지 않았거나 만료·회수된 현장 id → 존재 숨김 (C-T06)
  if (pick.kind === 'denied') notFound();
  const t = await getTranslations();

  if (pick.kind !== 'selected') {
    return (
      <main data-screen-id="FW-01" className="flex flex-col gap-4">
        <PageHeader title={t('photos.screen.field')} />
        {pick.kind === 'none' ? (
          <EmptyState title={t('photos.crew.noSites')} />
        ) : (
          <>
            <SiteSelector sites={sites} selected={null} />
            <EmptyState
              title={t('photos.crew.selectSite')}
              description={t('photos.crew.uploadNeedsSite')}
              action={
                <Button disabled data-ui-key="photo-upload-open">
                  {t('photos.action.upload')}
                </Button>
              }
            />
          </>
        )}
      </main>
    );
  }

  const site = pick.site;
  const access = await requireProjectAccess(site.projectId, ['field']);
  const filters = parsePhotoListParams(sp, access.as);
  const [{ items, hasMore }, { items: uploaders }, detail] = await Promise.all([
    listPhotos(site.projectId, access, filters),
    listPhotoUploaders(site.projectId, access, { archived: filters.archived }),
    getFieldSite(site.projectId),
  ]);
  // F9: 담당자가 '시공팀 사진 바로 공개'를 켰으면 안내도 바꾼다
  const autoPublic = detail?.photoAutoPublic === true;
  const base = routes.field.photos();
  const extra = { project: site.projectId };

  return (
    <main data-screen-id="FW-01" key={site.projectId} className="flex flex-col gap-4">
      <PageHeader
        title={t('photos.screen.field')}
        description={t(autoPublic ? 'photos.crew.autoPublicNotice' : 'photos.crew.privateNotice')}
        actions={
          <PhotoUploadSheet
            projectId={site.projectId}
            companyId={access.companyId}
            allowPublic={false}
            trigger="upload"
            siteName={site.name}
            crewAutoPublic={autoPublic}
          />
        }
      />
      {sites.length > 1 ? (
        <SiteSelector sites={sites} selected={site.projectId} />
      ) : (
        <p className="bg-card flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-4 py-3 text-sm font-medium">
          <MapPin className="size-4" aria-hidden />
          {site.name}
          {site.siteAddress ? (
            <span className="text-muted-foreground text-meta font-normal">{site.siteAddress}</span>
          ) : null}
        </p>
      )}
      <PhotoFilters
        base={base}
        filters={filters}
        uploaders={uploaders}
        showArchiveTabs={false}
        extra={extra}
      />
      {items.length === 0 ? (
        hasPhotoFilter(filters) ? (
          <FilterEmptyState
            message={t('common.state.filterEmpty')}
            resetHref={routes.field.photos(site.projectId)}
            resetLabel={t('common.action.resetFilters')}
          />
        ) : (
          <EmptyState title={t('photos.list.empty')} />
        )
      ) : (
        <PhotoGrid
          items={items}
          showVisibility
          showUploader
          detailHref={(p) => routes.field.photo(p.id, site.projectId)}
        />
      )}
      <LoadMore
        href={
          hasMore ? photoListHref(base, filters, { size: filters.size + PAGE_SIZE }, extra) : null
        }
        label={t('common.action.loadMore')}
      />
    </main>
  );
}

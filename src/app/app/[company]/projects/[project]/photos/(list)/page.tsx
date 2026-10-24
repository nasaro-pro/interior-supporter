// PM-07 사진 목록 + 다중 업로드 (D3) — REQ-210, REQ-211
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireProjectAccess } from '@/features/core';
import { PhotoFilters } from '@/features/photos/components/PhotoFilters';
import { PhotoGrid } from '@/features/photos/components/PhotoGrid';
import { PhotoUploadSheet } from '@/features/photos/components/PhotoUploadSheet';
import {
  hasPhotoFilter,
  parsePhotoListParams,
  photoListHref,
} from '@/features/photos/lib/list-params';
import { listPhotoUploaders, listPhotos } from '@/features/photos/server/queries';
import type { SearchParams } from '@/features/requests/lib/list-params';
import { PAGE_SIZE } from '@/shared/contracts/domain';
import { routes } from '@/shared/contracts/routes';
import { LoadMore } from '@/shared/ui/page-parts';
import { SectionHeader } from '@/shared/ui/section';
import { EmptyState, FilterEmptyState } from '@/shared/ui/states';

type Props = {
  params: Promise<{ company: string; project: string }>;
  searchParams: Promise<SearchParams>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('photos');
  return { title: t('screen.list') };
}

export default async function PmPhotoListPage({ params, searchParams }: Props) {
  const { company, project } = await params;
  const access = await requireProjectAccess(project, ['editor']);
  if (access.companySlug !== company) notFound();
  const filters = parsePhotoListParams(await searchParams, access.as);
  const [{ items, hasMore }, { items: uploaders }] = await Promise.all([
    listPhotos(project, access, filters),
    listPhotoUploaders(project, access, { archived: filters.archived }),
  ]);
  const t = await getTranslations();
  const base = routes.app.project(company, project, 'photos');

  return (
    <main data-screen-id="PM-07" className="flex flex-col gap-4">
      <SectionHeader
        title={t('photos.screen.list')}
        description={t('photos.form.publicHint')}
        actions={
          <PhotoUploadSheet
            projectId={project}
            companyId={access.companyId}
            allowPublic
            trigger="mode"
          />
        }
      />
      <PhotoFilters base={base} filters={filters} uploaders={uploaders} showArchiveTabs />
      {items.length === 0 ? (
        hasPhotoFilter(filters) ? (
          <FilterEmptyState
            message={t('common.state.filterEmpty')}
            resetHref={photoListHref(base, filters, {
              phase: null,
              from: null,
              to: null,
              uploader: null,
              size: PAGE_SIZE,
            })}
            resetLabel={t('common.action.resetFilters')}
          />
        ) : (
          <EmptyState title={filters.archived ? t('common.state.empty') : t('photos.list.empty')} />
        )
      ) : (
        <PhotoGrid
          items={items}
          showVisibility
          showUploader
          detailHref={(p) => routes.app.photo(company, project, p.id)}
        />
      )}
      <LoadMore
        href={hasMore ? photoListHref(base, filters, { size: filters.size + PAGE_SIZE }) : null}
        label={t('common.action.loadMore')}
      />
    </main>
  );
}

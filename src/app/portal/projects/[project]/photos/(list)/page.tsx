// CL-07 사진 목록 (D3) — 공개분만, 업로드·수정 없음 (REQ-210, POL-004). 업로더 표시·필터 (C 결정 2026-10-07)
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getAccessContext, requireProjectAccess } from '@/features/core';
import { PhotoFilters } from '@/features/photos/components/PhotoFilters';
import { PhotoGrid } from '@/features/photos/components/PhotoGrid';
import {
  hasPhotoFilter,
  parsePhotoListParams,
  photoListHref,
} from '@/features/photos/lib/list-params';
import {
  countPhotoComments,
  listPhotoUploaders,
  listPhotos,
} from '@/features/photos/server/queries';
import type { SearchParams } from '@/features/requests/lib/list-params';
import { PAGE_SIZE } from '@/shared/contracts/domain';
import { routes } from '@/shared/contracts/routes';
import { LoadMore } from '@/shared/ui/page-parts';
import { SectionHeader } from '@/shared/ui/section';
import { EmptyState, FilterEmptyState } from '@/shared/ui/states';

type Props = { params: Promise<{ project: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('photos');
  return { title: t('screen.list') };
}

export default async function PortalPhotoListPage({ params, searchParams }: Props) {
  const { project } = await params;
  const access = await requireProjectAccess(project, ['customer']);
  const filters = parsePhotoListParams(await searchParams, access.as);
  // 업로더 선택지도 공개·보관 조건을 목록과 같게 (C-02 이중 검증) — 비공개 사진의 업로더는 드러나지 않는다
  const [{ items, hasMore }, { items: uploaders }, ctx] = await Promise.all([
    listPhotos(project, access, filters),
    listPhotoUploaders(project, access, { archived: filters.archived }),
    getAccessContext(),
  ]);
  // CU-07: 카드에 내 댓글 대화 수
  const commentCounts = await countPhotoComments(
    items.map((p) => p.id),
    access,
    ctx.userId,
  );
  const t = await getTranslations();
  const base = routes.portal.project(project, 'photos');

  return (
    <main data-screen-id="CL-07" className="flex flex-col gap-4">
      <SectionHeader title={t('photos.screen.list')} />
      <PhotoFilters base={base} filters={filters} uploaders={uploaders} showArchiveTabs={false} />
      {items.length === 0 ? (
        hasPhotoFilter(filters) ? (
          <FilterEmptyState
            message={t('common.state.filterEmpty')}
            resetHref={base}
            resetLabel={t('common.action.resetFilters')}
          />
        ) : (
          <EmptyState title={t('photos.list.emptyCustomer')} />
        )
      ) : (
        <PhotoGrid
          items={items}
          showVisibility={false}
          showUploader
          commentCounts={commentCounts}
          detailHref={(p) => routes.portal.photo(project, p.id)}
        />
      )}
      <LoadMore
        href={hasMore ? photoListHref(base, filters, { size: filters.size + PAGE_SIZE }) : null}
        label={t('common.action.loadMore')}
      />
    </main>
  );
}

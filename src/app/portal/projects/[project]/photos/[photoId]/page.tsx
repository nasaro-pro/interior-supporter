// CL-17 사진 상세 (D4) — 공개 사진만, 보기·원본 다운로드 (REQ-212, C-T04)
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireProjectAccess } from '@/features/core';
import { PhotoDetailView } from '@/features/photos/components/PhotoDetailView';
import { getPhoto } from '@/features/photos/server/queries';
import { isUuid } from '@/features/requests/lib/list-params';
import { routes } from '@/shared/contracts/routes';

type Props = { params: Promise<{ project: string; photoId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('photos');
  return { title: t('screen.detail') };
}

export default async function PortalPhotoDetailPage({ params }: Props) {
  const { project, photoId } = await params;
  const access = await requireProjectAccess(project, ['customer']);
  if (!isUuid(photoId)) notFound();
  // RLS + 쿼리 이중 검증: 비공개는 null, 보관본은 고객에게 없는 항목 → 404 (존재 숨김, C-03)
  const photo = await getPhoto(project, photoId, access);
  if (!photo || !photo.isPublic || photo.archived) notFound();

  return (
    <main data-screen-id="CL-17" className="flex flex-col gap-6">
      <PhotoDetailView
        photo={photo}
        listHref={routes.portal.project(project, 'photos')}
        showVisibility={false}
        showUploader
      />
    </main>
  );
}

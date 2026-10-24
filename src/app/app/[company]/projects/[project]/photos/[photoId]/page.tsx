// PM-17 사진 상세 (D4) — 정보 수정·공개·보관 (REQ-212, REQ-213)
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireProjectAccess } from '@/features/core';
import { PhotoDetailView } from '@/features/photos/components/PhotoDetailView';
import { PhotoEditSheet } from '@/features/photos/components/PhotoEditSheet';
import { PhotoManageActions } from '@/features/photos/components/PhotoManageActions';
import { getPhoto } from '@/features/photos/server/queries';
import { isUuid } from '@/features/requests/lib/list-params';
import { routes } from '@/shared/contracts/routes';

type Props = { params: Promise<{ company: string; project: string; photoId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('photos');
  return { title: t('screen.detail') };
}

export default async function PmPhotoDetailPage({ params }: Props) {
  const { company, project, photoId } = await params;
  const access = await requireProjectAccess(project, ['editor']);
  if (access.companySlug !== company || !isUuid(photoId)) notFound();
  const photo = await getPhoto(project, photoId, access);
  if (!photo) notFound();

  return (
    <main data-screen-id="PM-17" className="flex flex-col gap-6">
      <PhotoDetailView
        photo={photo}
        listHref={routes.app.project(company, project, 'photos')}
        showVisibility
        showUploader
        actions={
          <div className="flex flex-col gap-3" key={photo.version}>
            {!photo.archived ? <PhotoEditSheet photo={photo} /> : null}
            <PhotoManageActions photo={photo} />
          </div>
        }
      />
    </main>
  );
}

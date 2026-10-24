// FW-02 시공팀 사진 상세 (D2) — 본인 사진만 공정·촬영일·설명 수정, 공개·보관 없음 (REQ-222, POL-005)
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getAccessContext, requireProjectAccess } from '@/features/core';
import { PhotoDetailView } from '@/features/photos/components/PhotoDetailView';
import { PhotoEditSheet } from '@/features/photos/components/PhotoEditSheet';
import { listFieldSites } from '@/features/photos/server/field-sites';
import { getPhoto } from '@/features/photos/server/queries';
import { firstParam, isUuid, type SearchParams } from '@/features/requests/lib/list-params';
import { routes } from '@/shared/contracts/routes';

type Props = { params: Promise<{ photoId: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('photos');
  return { title: t('screen.detail') };
}

export default async function FieldPhotoDetailPage({ params, searchParams }: Props) {
  const { photoId } = await params;
  const project = firstParam(await searchParams, 'project') ?? null;
  if (!isUuid(photoId) || !isUuid(project)) notFound();
  const ctx = await getAccessContext();
  const sites = await listFieldSites(ctx);
  if (!sites.some((s) => s.projectId === project)) notFound(); // 만료·회수·다른 현장 차단 (C-T06)
  const access = await requireProjectAccess(project, ['field']);
  const photo = await getPhoto(project, photoId, access);
  // 보관 사진은 시공팀에게 없는 항목 — 편집 UI 도 열지 않고 404 (C-03)
  if (!photo || photo.archived) notFound();
  const t = await getTranslations('photos');
  const own = photo.uploaderId === ctx.userId;

  return (
    <main data-screen-id="FW-02" className="flex flex-col gap-6">
      <PhotoDetailView
        photo={photo}
        headingLevel="h1"
        listHref={routes.field.photos(project)}
        showVisibility
        showUploader
        actions={
          own ? (
            <PhotoEditSheet key={photo.version} photo={photo} />
          ) : (
            <p className="text-muted-foreground text-meta">{t('detail.editOwnOnly')}</p>
          )
        }
      />
    </main>
  );
}

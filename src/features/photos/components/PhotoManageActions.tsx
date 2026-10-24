'use client';
// PM-17 공개 전환·보관 (편집자만, REQ-213, POL-017·POL-020). 업로드 ≠ 공개 승인
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, Eye, EyeOff } from 'lucide-react';
import type { AppError } from '@/shared/contracts/errors';
import { ActionError } from '@/shared/ui/action-error';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { setPhotoArchived, setPhotoPublic } from '../server/actions';
import type { PhotoItem } from '../types';

export function PhotoManageActions({ photo }: { photo: PhotoItem }) {
  const t = useTranslations();
  const router = useRouter();
  const [error, setError] = useState<AppError | null>(null);
  const [pending, startTransition] = useTransition();
  const base = { projectId: photo.projectId, photoId: photo.id, baseVersion: photo.version };

  const togglePublic = () =>
    startTransition(async () => {
      const res = await setPhotoPublic({ ...base, isPublic: !photo.isPublic });
      if (!res.ok) return setError(res.error);
      setError(null);
      toast.success(photo.isPublic ? t('photos.toast.unpublished') : t('photos.toast.published'));
      router.refresh();
    });

  const archive = async (archived: boolean) => {
    const res = await setPhotoArchived({ ...base, archived });
    if (!res.ok) return setError(res.error);
    setError(null);
    toast.success(archived ? t('photos.toast.archived') : t('photos.toast.restored'));
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {!photo.archived ? (
          <Button
            variant={photo.isPublic ? 'outline' : 'default'}
            onClick={togglePublic}
            pending={pending}
            data-ui-key="photo-publish-toggle"
          >
            {photo.isPublic ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            {photo.isPublic ? t('common.action.unpublish') : t('common.action.publish')}
          </Button>
        ) : null}
        {photo.archived ? (
          <Button
            variant="outline"
            onClick={() => startTransition(() => archive(false))}
            pending={pending}
            data-ui-key="photo-restore"
          >
            <ArchiveRestore aria-hidden />
            {t('common.action.restore')}
          </Button>
        ) : (
          // 트리거 photo-archive · 패널 photo-archive-dialog · 확인 photo-archive-confirm
          <ConfirmDialog
            trigger={
              <>
                <Archive aria-hidden />
                {t('common.action.archive')}
              </>
            }
            triggerSize="default"
            uiKey="photo-archive"
            title={t('common.confirm.archive.title')}
            body={t('common.confirm.archive.body')}
            confirmLabel={t('common.action.archive')}
            onConfirm={() => archive(true)}
          />
        )}
      </div>
      <ActionError error={error} />
    </div>
  );
}

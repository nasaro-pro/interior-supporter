'use client';
// 홈페이지 전용 로고 — 첨부 / 바꾸기 / 빼기 (누르면 바로 적용, [저장] 과 따로) · 로고 숨기기(폼 값, [저장] 으로 반영)
// 큰 사진은 브라우저에서 긴 변 1024px PNG 로 줄여 보낸다 (투명 배경 유지, 서버 액션 1MB 한도 안). 서버가 다시 검사·변환한다
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { LOGO_ACCEPT, LOGO_MAX_BYTES, LOGO_PREP_EDGE } from '@/features/portfolio/lib/logo';
import { publicImageUrl } from '@/features/portfolio/routes';
import { removePortfolioLogo, uploadPortfolioLogo } from '@/features/portfolio/server/logo-actions';

async function shrink(file: File): Promise<Blob> {
  if (file.size <= LOGO_MAX_BYTES && typeof createImageBitmap !== 'function') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, LOGO_PREP_EDGE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size <= LOGO_MAX_BYTES) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    return blob ?? file;
  } catch {
    return file; // 브라우저가 못 읽는 형식 → 서버가 형식 오류로 알려 준다
  }
}

export function LogoField({
  companyId,
  name,
  customLogoPath,
  companyLogoPath,
  hidden,
  onHiddenChange,
}: {
  companyId: string;
  name: string;
  customLogoPath: string | null;
  companyLogoPath: string | null;
  /** 로고 숨기기 — 폼 값 ([저장] 으로 반영) */
  hidden: boolean;
  onHiddenChange: (hidden: boolean) => void;
}) {
  const t = useTranslations('portfolio.manage.identity');
  const te = useTranslations('errors');
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const shown = customLogoPath ?? companyLogoPath;

  const pick = (file: File | undefined) => {
    if (!file) return;
    start(async () => {
      setBusy(true);
      const blob = await shrink(file);
      const fd = new FormData();
      fd.set('companyId', companyId);
      fd.set('file', blob, 'logo');
      const res = await uploadPortfolioLogo(fd);
      setBusy(false);
      if (input.current) input.current.value = '';
      if (res.ok) {
        toast.success(t('logoUploaded'));
        router.refresh();
      } else toast.error(te(res.error.code));
    });
  };
  const remove = () =>
    start(async () => {
      const res = await removePortfolioLogo({ companyId });
      if (res.ok) {
        toast.success(t('logoRemoved'));
        router.refresh();
      } else toast.error(te(res.error.code));
    });

  return (
    <div className="flex flex-col gap-3" data-ui-key="portfolio-settings-logo">
      <label className="flex w-max items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={hidden}
          onChange={(e) => onHiddenChange(e.target.checked)}
          data-ui-key="portfolio-settings-logo-hidden"
        />
        {t('logoHide')}
      </label>
      {hidden ? (
        <p
          className="text-muted-foreground text-meta"
          data-ui-key="portfolio-settings-logo-hidden-note"
        >
          {t('logoHiddenNote')}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-muted grid size-16 shrink-0 place-items-center overflow-hidden rounded-md border">
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element -- 공개 버킷 주소
              <img
                src={publicImageUrl(shown)}
                alt={t('logoAlt', { name })}
                className="size-full object-contain"
              />
            ) : (
              <span aria-hidden className="text-muted-foreground text-xl font-semibold">
                {name.slice(0, 1)}
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="text-muted-foreground text-meta" aria-live="polite">
              {busy
                ? t('logoProcessing')
                : customLogoPath
                  ? t('logoCustom')
                  : companyLogoPath
                    ? t('logoFromCompany')
                    : t('logoNone')}
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                ref={input}
                type="file"
                accept={LOGO_ACCEPT}
                className="sr-only"
                id="pf-logo-file"
                onChange={(e) => pick(e.target.files?.[0])}
                disabled={pending}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => input.current?.click()}
                disabled={pending}
                aria-busy={pending}
                data-ui-key="portfolio-settings-logo-upload"
              >
                <ImagePlus aria-hidden />
                {customLogoPath ? t('logoChange') : t('logoUpload')}
              </Button>
              {customLogoPath ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={remove}
                  disabled={pending}
                  data-ui-key="portfolio-settings-logo-remove"
                >
                  <Trash2 aria-hidden />
                  {t('logoRemove')}
                </Button>
              ) : null}
            </div>
            <p className="text-muted-foreground text-meta">{t('logoHint')}</p>
          </div>
        </div>
      )}
    </div>
  );
}

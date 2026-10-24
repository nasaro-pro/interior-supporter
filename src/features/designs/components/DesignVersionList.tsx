// PM-14 버전 이력 (REQ-102·103) — 버전별 원본 다운로드. 고객은 RLS 로 현재 버전만 받는다
import { getLocale, getTranslations } from 'next-intl/server';
import { formatDateTime } from '@/shared/lib/dates';
import { FileDownloadLink, sizeParts } from '@/features/files';
import { Download } from 'lucide-react';
import { ToneBadge } from '@/shared/ui/tone-badge';
import { Section } from '@/shared/ui/section';
import { linkClass } from '@/shared/ui/styles';
import type { DesignVersionItem } from '@/features/designs/types';

export async function DesignVersionList({
  versions,
  currentVersion,
}: {
  versions: DesignVersionItem[];
  currentVersion: number;
}) {
  const t = await getTranslations('designs');
  const tf = await getTranslations('files');
  const locale = (await getLocale()) === 'en' ? 'en' : 'ko';
  return (
    <Section title={t('action.versionHistory')}>
      <ul className="flex flex-col gap-2">
        {versions.map((v) => {
          const size = v.file ? sizeParts(v.file.sizeBytes) : null;
          return (
            <li
              key={v.id}
              data-key={v.id}
              className="bg-card flex min-w-0 flex-col gap-1 rounded-lg border p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{t('field.version', { no: v.versionNo })}</span>
                {v.versionNo === currentVersion ? (
                  <ToneBadge tone="brand">{t('field.currentVersion')}</ToneBadge>
                ) : (
                  <span className="text-meta text-muted-foreground">
                    {t('version.olderNotice')}
                  </span>
                )}
                <span className="text-meta text-muted-foreground" data-numeric>
                  {formatDateTime(v.createdAt, locale)}
                </span>
              </div>
              {v.note ? <p className="text-muted-foreground">{v.note}</p> : null}
              {v.file && size ? (
                <p className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="min-w-0 truncate">{v.file.name}</span>
                  <span className="text-meta text-muted-foreground">
                    {tf(`size.${size.unit}`, { value: size.value })}
                  </span>
                  <FileDownloadLink
                    fileId={v.file.id}
                    uiKey="design-version-download"
                    className={`${linkClass} inline-flex items-center gap-1`}
                  >
                    <Download aria-hidden className="size-4" />
                    {t('action.downloadOriginal')}
                  </FileDownloadLink>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

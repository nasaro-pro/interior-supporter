// FW-05 확정 도안 (F2, 보기만) — 확정 리비전의 미리보기와 원본 내려받기. 파일은 /api/files 가 권한을 다시 검사한다
import { useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import { routes } from '@/shared/contracts/routes';
import { ButtonLink } from '@/shared/ui/button-link';
import type { FieldDesign } from '../types';

export function FieldDesignList({ designs }: { designs: FieldDesign[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {designs.map((d) => (
        <li key={d.id} data-key={d.id}>
          <DesignCard design={d} />
        </li>
      ))}
    </ul>
  );
}

function DesignCard({ design }: { design: FieldDesign }) {
  const t = useTranslations('field.design');
  return (
    <article className="bg-card flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold wrap-anywhere">{design.title}</h2>
          <p className="text-muted-foreground text-meta">
            {t('version', { no: design.confirmedVersion })}
          </p>
        </div>
        {design.originalFileId ? (
          <ButtonLink
            href={routes.file(design.originalFileId, { download: true })}
            variant="outline"
            size="sm"
            prefetch={false}
            data-ui-key="field-design-download"
          >
            <Download className="size-4" aria-hidden />
            {t('download')}
          </ButtonLink>
        ) : null}
      </div>
      {design.description ? (
        <p className="text-sm wrap-anywhere whitespace-pre-line">{design.description}</p>
      ) : null}
      {design.previews.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {design.previews.map((p) => (
            <li key={p.fileId}>
              <figure className="flex flex-col gap-1">
                <a href={routes.file(p.fileId)} target="_blank" rel="noopener">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 서명 URL 로 302 되는 권한 검사 경로 */}
                  <img
                    src={routes.file(p.fileId)}
                    alt={p.label ?? design.title}
                    loading="lazy"
                    className="bg-muted aspect-[4/3] w-full rounded-md border object-contain"
                  />
                </a>
                {p.label ? <figcaption className="text-meta">{p.label}</figcaption> : null}
              </figure>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">{t('noPreview')}</p>
      )}
    </article>
  );
}

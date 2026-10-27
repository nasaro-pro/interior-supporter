// FW-06 확정 자재 (F2, 보기만) — 공간·사양·수량·위치. 단가는 보여 주지 않는다
import { useTranslations } from 'next-intl';
import { routes } from '@/shared/contracts/routes';
import type { FieldMaterial } from '../types';

export function FieldMaterialList({ materials }: { materials: FieldMaterial[] }) {
  return (
    <ul className="bg-card divide-y rounded-lg border">
      {materials.map((m) => (
        <li key={m.id} data-key={m.id}>
          <MaterialRow material={m} />
        </li>
      ))}
    </ul>
  );
}

function MaterialRow({ material: m }: { material: FieldMaterial }) {
  const t = useTranslations();
  const qty = m.quantity !== null ? `${m.quantity}${m.unit ? ` ${m.unit}` : ''}` : null;
  return (
    <div className="flex gap-3 px-4 py-3">
      {m.imageFileId ? (
        // eslint-disable-next-line @next/next/no-img-element -- 서명 URL 로 302 되는 권한 검사 경로
        <img
          src={routes.file(m.imageFileId)}
          alt=""
          loading="lazy"
          className="bg-muted size-16 shrink-0 rounded-md border object-cover"
        />
      ) : (
        <div aria-hidden className="bg-muted size-16 shrink-0 rounded-md border" />
      )}
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-medium wrap-anywhere">
          {m.name}
          {m.category ? (
            <span className="text-muted-foreground text-meta ms-2">{m.category}</span>
          ) : null}
        </p>
        <p className="text-meta text-muted-foreground">
          {t(`materials.space.${m.space}`)}
          {m.spec ? ` · ${m.spec}` : ''}
          {qty ? ` · ${qty}` : ''}
        </p>
        {m.locationNote ? (
          <p className="text-sm wrap-anywhere">
            <span className="text-muted-foreground">{t('field.material.location')} </span>
            {m.locationNote}
          </p>
        ) : null}
      </div>
    </div>
  );
}

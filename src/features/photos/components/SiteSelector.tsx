// FW-01 현장 선택 = 필터 (뎁스 아님) — GET 폼, 현장을 고르면 ?project= 로 이동 (REQ-220)
import { useTranslations } from 'next-intl';
import { MapPin } from 'lucide-react';
import { routes } from '@/shared/contracts/routes';
import { Button } from '@/shared/ui/button';
import { NativeSelect } from '@/shared/ui/native-fields';
import type { FieldSite } from '../lib/site';

export function SiteSelector({ sites, selected }: { sites: FieldSite[]; selected: string | null }) {
  const t = useTranslations('photos');
  return (
    <form
      method="get"
      action={routes.field.photos()}
      className="bg-card flex flex-wrap items-end gap-3 rounded-lg border p-4"
    >
      <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5 sm:max-w-sm">
        <label htmlFor="field-site" className="flex items-center gap-1 text-sm font-medium">
          <MapPin className="size-4" aria-hidden />
          {t('field.site')}
        </label>
        <NativeSelect
          id="field-site"
          name="project"
          defaultValue={selected ?? ''}
          required
          aria-required
          data-ui-key="field-site-select"
        >
          <option value="" disabled>
            {t('crew.chooseSite')}
          </option>
          {sites.map((s) => (
            <option key={s.projectId} value={s.projectId}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button type="submit" variant="outline" data-ui-key="field-site-apply">
        {t('crew.move')}
      </Button>
    </form>
  );
}

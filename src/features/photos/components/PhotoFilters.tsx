// 사진 필터바 — 진행/보관함(분할 탭) + 공정·촬영일 범위·업로더 독립 필터 (REQ-210). GET 폼 (새로고침·뒤로가기 유지)
import { useTranslations } from 'next-intl';
import { ListFilter } from 'lucide-react';
import { PHOTO_PHASES } from '@/shared/contracts/domain';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/native-fields';
import { SegmentedTabs } from '@/shared/ui/segmented-tabs';
import { photoListHref } from '../lib/list-params';
import type { PhotoListFilters } from '../types';

const fieldClass = 'flex min-w-0 flex-col gap-1.5';
const labelClass = 'text-sm font-medium';

export function PhotoFilters({
  base,
  filters,
  uploaders,
  showArchiveTabs,
  extra = {},
}: {
  base: string;
  filters: PhotoListFilters;
  uploaders: { id: string; name: string | null }[] | null;
  showArchiveTabs: boolean;
  /** 시공팀 화면의 ?project= 처럼 항상 유지할 query */
  extra?: Record<string, string>;
}) {
  const t = useTranslations('photos');
  const tc = useTranslations('common');
  return (
    <div className="flex flex-col gap-3">
      {showArchiveTabs ? (
        <SegmentedTabs
          label={tc('filter.archived')}
          items={[false, true].map((archived) => ({
            key: String(archived),
            href: photoListHref(base, filters, { archived, size: 30 }, extra),
            label: archived ? tc('filter.archived') : tc('filter.active'),
            current: filters.archived === archived,
            uiKey: archived ? 'photo-filter-archived' : 'photo-filter-active',
          }))}
        />
      ) : null}
      <form
        method="get"
        action={base}
        aria-label={t('filter.label')}
        className="flex flex-wrap items-end gap-3"
      >
        {Object.entries(extra).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        {filters.archived ? <input type="hidden" name="archived" value="1" /> : null}
        <div className={`${fieldClass} flex-[1_1_140px]`}>
          <label htmlFor="photo-phase" className={labelClass}>
            {t('filter.phase')}
          </label>
          <NativeSelect id="photo-phase" name="phase" defaultValue={filters.phase ?? ''}>
            <option value="">{t('filter.allPhases')}</option>
            {PHOTO_PHASES.map((p) => (
              <option key={p} value={p}>
                {t(`phase.${p}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className={`${fieldClass} flex-[1_1_150px]`}>
          <label htmlFor="photo-from" className={labelClass}>
            {t('filter.from')}
          </label>
          <Input id="photo-from" type="date" name="from" defaultValue={filters.from ?? ''} />
        </div>
        <div className={`${fieldClass} flex-[1_1_150px]`}>
          <label htmlFor="photo-to" className={labelClass}>
            {t('filter.to')}
          </label>
          <Input id="photo-to" type="date" name="to" defaultValue={filters.to ?? ''} />
        </div>
        {uploaders ? (
          <div className={`${fieldClass} flex-[1_1_160px]`}>
            <label htmlFor="photo-uploader" className={labelClass}>
              {t('filter.uploader')}
            </label>
            <NativeSelect id="photo-uploader" name="uploader" defaultValue={filters.uploader ?? ''}>
              <option value="">{t('filter.allUploaders')}</option>
              {uploaders.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? t('list.unknownUploader')}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
        <Button type="submit" variant="outline" data-ui-key="photo-filter-apply">
          <ListFilter aria-hidden />
          {t('filter.apply')}
        </Button>
      </form>
    </div>
  );
}

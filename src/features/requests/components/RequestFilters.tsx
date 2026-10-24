// 요청 목록 필터바 — 진행/보관함(분할 탭) + 검색·상태 (GET 폼: 새로고침·뒤로가기에서 유지, JS 없이 동작)
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { REQUEST_STATUSES } from '@/shared/contracts/domain';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/native-fields';
import { SegmentedTabs } from '@/shared/ui/segmented-tabs';
import type { RequestListFilters } from '../types';
import { requestListHref } from '../lib/list-params';

const fieldClass = 'flex min-w-0 flex-col gap-1.5';
const labelClass = 'text-sm font-medium';

export function RequestFilters({
  base,
  filters,
  showArchiveTabs,
}: {
  base: string;
  filters: RequestListFilters;
  showArchiveTabs: boolean;
}) {
  const t = useTranslations('requests');
  const tc = useTranslations('common');
  return (
    <div className="flex flex-col gap-3">
      {showArchiveTabs ? (
        <SegmentedTabs
          label={tc('filter.archived')}
          items={[false, true].map((archived) => ({
            key: String(archived),
            href: requestListHref(base, filters, { archived, size: 30 }),
            label: archived ? tc('filter.archived') : tc('filter.active'),
            current: filters.archived === archived,
            uiKey: archived ? 'request-filter-archived' : 'request-filter-active',
          }))}
        />
      ) : null}
      <form
        method="get"
        action={base}
        role="search"
        aria-label={t('filter.label')}
        className="flex flex-wrap items-end gap-3"
      >
        {filters.archived ? <input type="hidden" name="archived" value="1" /> : null}
        <div className={`${fieldClass} flex-[2_1_240px]`}>
          <label htmlFor="request-q" className={labelClass}>
            {t('filter.search')}
          </label>
          <Input
            id="request-q"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder={t('filter.searchPlaceholder')}
            maxLength={100}
          />
        </div>
        <div className={`${fieldClass} flex-[1_1_160px]`}>
          <label htmlFor="request-status" className={labelClass}>
            {t('filter.status')}
          </label>
          <NativeSelect id="request-status" name="status" defaultValue={filters.status ?? ''}>
            <option value="">{t('filter.allStatuses')}</option>
            {REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" variant="outline" data-ui-key="request-filter-apply">
          <Search aria-hidden />
          {t('filter.apply')}
        </Button>
      </form>
    </div>
  );
}

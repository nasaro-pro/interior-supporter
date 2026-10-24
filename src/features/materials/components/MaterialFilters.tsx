'use client';
// PM-05 / CL-05 자재 필터 (REQ-110) — 카테고리·공간·검색어 독립 결합, query 로 표현 (새 뎁스 아님)
import { useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MATERIAL_SPACES } from '@/shared/contracts/domain';
import type { MaterialFilter } from '@/features/materials/schema';
import { RotateCcw, Search } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/native-fields';

export function MaterialFilters({
  categories,
  value,
}: {
  categories: string[];
  value: MaterialFilter;
}) {
  const t = useTranslations('materials');
  const tc = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(value.q ?? '');
  const [, start] = useTransition();

  const apply = (next: Partial<Record<'category' | 'space' | 'q', string>>) => {
    const s = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) s.set(k, v);
      else s.delete(k);
    }
    s.delete('limit');
    const qs = s.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const active = !!(value.category || value.space || value.q);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        apply({ q: q.trim() });
      }}
      aria-label={tc('action.search')}
      className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap"
    >
      <label className="flex min-w-0 flex-col gap-1.5 text-sm sm:w-40">
        <span className="font-medium">{t('filter.category')}</span>
        <NativeSelect
          value={value.category ?? ''}
          onChange={(e) => apply({ category: e.target.value })}
          data-ui-key="material-filter-category"
        >
          <option value="">{tc('filter.all')}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
      </label>
      <label className="flex min-w-0 flex-col gap-1.5 text-sm sm:w-40">
        <span className="font-medium">{t('filter.space')}</span>
        <NativeSelect
          value={value.space ?? ''}
          onChange={(e) => apply({ space: e.target.value })}
          data-ui-key="material-filter-space"
        >
          <option value="">{tc('filter.all')}</option>
          {MATERIAL_SPACES.map((s) => (
            <option key={s} value={s}>
              {t(`space.${s}`)}
            </option>
          ))}
        </NativeSelect>
      </label>
      <label className="col-span-2 flex min-w-0 flex-col gap-1.5 text-sm sm:min-w-48 sm:flex-1">
        <span className="sr-only">{tc('action.search')}</span>
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('filter.searchPlaceholder')}
          maxLength={100}
          data-ui-key="material-filter-search"
        />
      </label>
      <Button type="submit" variant="outline" data-ui-key="material-filter-submit">
        <Search aria-hidden />
        {tc('action.search')}
      </Button>
      {active ? (
        <Button
          variant="ghost"
          onClick={() => {
            setQ('');
            apply({ category: '', space: '', q: '' });
          }}
          data-ui-key="material-filter-reset"
        >
          <RotateCcw aria-hidden />
          {tc('action.resetFilters')}
        </Button>
      ) : null}
    </form>
  );
}

// src/features/admin/components/SearchForm.tsx — 목록 검색 (GET ?q=). 서버 컴포넌트, 자바스크립트 없이 동작
import { useTranslations } from 'next-intl';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

export function SearchForm({
  action,
  defaultValue,
  placeholder,
}: {
  action: string;
  defaultValue?: string;
  placeholder: string;
}) {
  const t = useTranslations('admin.search');
  return (
    <form action={action} method="get" role="search" className="flex max-w-md gap-2">
      <label htmlFor="admin-search" className="sr-only">
        {t('label')}
      </label>
      <Input
        id="admin-search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={80}
      />
      <Button type="submit" variant="outline" data-ui-key="admin-search-submit">
        {t('submit')}
      </Button>
    </form>
  );
}

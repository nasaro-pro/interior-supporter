// PM-30 프로젝트 필터 — 체크박스 GET 폼 (JS 없이 동작, 새로고침·뒤로가기 유지). 펼침(details)으로 접어 둔다
import { useTranslations } from 'next-intl';
import { ChevronDown, ListFilter } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { NativeCheckbox } from '@/shared/ui/native-fields';

export function CalendarProjectFilter({
  action,
  month,
  projects,
  selected,
}: {
  action: string;
  month: string;
  projects: { id: string; name: string }[];
  selected: string[];
}) {
  const t = useTranslations('schedule.filter');
  return (
    <details className="group bg-card rounded-lg border" open={selected.length > 0}>
      <summary className="hover:bg-muted focus-visible:ring-ring/50 flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-4 text-sm outline-none focus-visible:ring-3 [&::-webkit-details-marker]:hidden">
        <ListFilter className="size-4" aria-hidden />
        <span className="font-medium">{t('projects')}</span>
        <span className="text-muted-foreground text-meta ms-auto" data-numeric>
          {selected.length > 0 ? selected.length : t('allProjects')}
        </span>
        <ChevronDown
          className="size-4 group-open:rotate-180 motion-safe:transition-transform"
          aria-hidden
        />
      </summary>
      <form method="get" action={action} className="flex flex-col gap-3 border-t p-4">
        <input type="hidden" name="month" value={month} />
        <fieldset>
          <legend className="sr-only">{t('projects')}</legend>
          <ul className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <li key={p.id} data-key={p.id} className="min-w-0">
                <NativeCheckbox
                  name="projects"
                  value={p.id}
                  defaultChecked={selected.includes(p.id)}
                  label={p.name}
                  className="max-w-full [&>span]:truncate"
                />
              </li>
            ))}
          </ul>
        </fieldset>
        <div>
          <Button type="submit" variant="outline" data-ui-key="calendar-project-filter-apply">
            {t('apply')}
          </Button>
        </div>
      </form>
    </details>
  );
}

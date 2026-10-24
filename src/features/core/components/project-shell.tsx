'use client';
// src/features/core/components/project-shell.tsx (A · TASK-003, CT ProjectShell) — 프로젝트 탭·전환 (클라이언트 부분)
import Link from 'next/link';
import { useRouter, useSelectedLayoutSegment } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/utils';
import { NativeSelect } from '@/shared/ui/native-fields';

export function ProjectTabsNav({ tabs }: { tabs: { key: string; label: string; href: string }[] }) {
  const t = useTranslations('common.nav');
  const segment = useSelectedLayoutSegment();
  return (
    <nav aria-label={t('projectNav')} className="-mx-1 scrollbar-none overflow-x-auto">
      <ul className="flex min-w-max gap-1 border-b px-1">
        {tabs.map((tab) => {
          const active = segment === tab.key;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                data-ui-key={`project-tab-${tab.key}-link`}
                className={cn(
                  'text-muted-foreground hover:text-foreground -mb-px inline-flex h-10 items-center border-b-2 border-transparent px-3 text-sm font-medium',
                  active && 'border-primary text-foreground',
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** 헤더의 프로젝트 전환 — 선택 즉시 같은 탭이 아닌 해당 프로젝트 개요로 (이전 데이터 잔존 방지)
 *  현재 프로젝트가 목록(options)에 없으면(보관됨·최근 50개 밖) 맨 앞에 현재 항목을 넣어 선택 값이 맞게 보인다.
 *  보관된 프로젝트면 "(보관) 이름" (A-12) */
export function ProjectSwitcher({
  current,
  currentName,
  currentArchived = false,
  options,
}: {
  current: string;
  /** 현재 프로젝트 이름 — options 에 없을 때(보관됨) 표시용 */
  currentName?: string;
  currentArchived?: boolean;
  options: { id: string; name: string; href: string }[];
}) {
  const t = useTranslations('projects.switcher');
  const router = useRouter();
  const missing = !options.some((o) => o.id === current);
  const showCurrent = missing && currentName !== undefined;
  const count = options.length + (showCurrent ? 1 : 0);
  if (count < 2 || (missing && !showCurrent)) return null;
  return (
    <div className="w-full min-w-0 sm:w-56">
      <label htmlFor="project-switcher" className="sr-only">
        {t('label')}
      </label>
      <NativeSelect
        id="project-switcher"
        value={current}
        data-ui-key="project-switcher-select"
        onChange={(e) => {
          const target = options.find((o) => o.id === e.target.value);
          if (target) router.push(target.href);
        }}
      >
        {showCurrent ? (
          <option value={current} data-key="current-missing">
            {currentArchived ? t('archivedOption', { name: currentName }) : currentName}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

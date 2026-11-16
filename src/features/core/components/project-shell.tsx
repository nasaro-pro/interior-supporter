'use client';
// src/features/core/components/project-shell.tsx (A · TASK-003, CT ProjectShell) — 프로젝트 탭·전환 (클라이언트 부분)
import Link from 'next/link';
import { useRouter, useSelectedLayoutSegment } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/utils';
import { NativeSelect } from '@/shared/ui/native-fields';

export function ProjectTabsNav({
  tabs,
  variant = 'default',
}: {
  tabs: { key: string; label: string; href: string }[];
  /** 'underline': 고객 화면 — 넓은 간격 · 차콜 밑줄 (메인페이지와 같은 느낌) */
  variant?: 'default' | 'underline';
}) {
  const t = useTranslations('common.nav');
  const segment = useSelectedLayoutSegment();
  const underline = variant === 'underline';
  return (
    <nav
      aria-label={t('projectNav')}
      className={cn(
        'scrollbar-none overflow-x-auto',
        underline ? '-mx-5 mt-7 px-5 md:mx-0 md:mt-9 md:px-0' : '-mx-1',
      )}
    >
      <ul className={cn('flex min-w-max border-b', underline ? 'gap-6 md:gap-8' : 'gap-1 px-1')}>
        {tabs.map((tab) => {
          const active = segment === tab.key;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                data-ui-key={`project-tab-${tab.key}-link`}
                className={cn(
                  'text-muted-foreground hover:text-foreground -mb-px inline-flex items-center border-b-2 border-transparent',
                  underline ? 'h-11 text-[15px]' : 'h-10 px-3 text-sm font-medium',
                  active &&
                    (underline
                      ? 'border-foreground text-foreground font-semibold'
                      : 'border-primary text-foreground'),
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

// src/shared/ui/segmented-tabs.tsx (A) — 링크 기반 분할 탭 (진행/보관함·상태 필터). 목록 상태는 query — 새 뎁스 아님 (02 문서 4장)
// 현재 칸은 aria-current="page" + 바탕·글자 굵기로 구분 (색만으로 구분하지 않음). 서버·클라이언트 공용
import Link from 'next/link';
import { cn } from '@/shared/lib/utils';

export type SegmentedTabItem = {
  key: string;
  href: string;
  label: string;
  current: boolean;
  uiKey?: string;
  /** 칸 옆 건수 */
  count?: number;
};

export function SegmentedTabs({
  label,
  items,
  className,
}: {
  /** nav 이름 (aria-label) */
  label: string;
  items: SegmentedTabItem[];
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn('max-w-full scrollbar-none overflow-x-auto', className)}>
      <ul className="bg-muted inline-flex min-w-max gap-1 rounded-lg p-1">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              scroll={false}
              aria-current={item.current ? 'page' : undefined}
              data-ui-key={item.uiKey}
              className={cn(
                'focus-visible:ring-ring/50 inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm whitespace-nowrap outline-none focus-visible:ring-3',
                'motion-safe:transition-colors motion-safe:duration-150',
                item.current
                  ? 'bg-background text-foreground font-semibold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground font-medium',
              )}
            >
              {item.label}
              {item.count !== undefined ? (
                <span className="text-muted-foreground text-xs" data-numeric>
                  {item.count}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

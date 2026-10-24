// src/shared/ui/notice.tsx (A) — 톤 안내 상자 (보관됨·비공개·읽기 전용 등 화면 안 안내). 아이콘+문구, 색만으로 의미 전달 금지
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { TONE_CLASS, type Tone } from '@/shared/ui/tone-badge';

const DEFAULT_ICON: Record<Tone, LucideIcon> = {
  neutral: Info,
  brand: Info,
  info: Info,
  positive: CircleCheck,
  caution: TriangleAlert,
  attention: TriangleAlert,
  critical: CircleX,
};

export function Notice({
  tone = 'info',
  icon,
  title,
  children,
  role,
  className,
  uiKey,
}: {
  tone?: Tone;
  /** null 이면 아이콘 없음, 생략하면 톤 기본 아이콘 */
  icon?: LucideIcon | null;
  title?: ReactNode;
  children?: ReactNode;
  role?: 'status' | 'alert' | 'note';
  className?: string;
  /** data-ui-key (선택) */
  uiKey?: string;
}) {
  const Icon = icon === null ? null : (icon ?? DEFAULT_ICON[tone]);
  return (
    <div
      role={role}
      data-tone={tone}
      data-ui-key={uiKey}
      className={cn(
        'flex items-start gap-2 rounded-md px-3 py-2 text-sm',
        TONE_CLASS[tone],
        className,
      )}
    >
      {Icon ? <Icon aria-hidden className="mt-0.5 size-4 shrink-0" /> : null}
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={title ? 'mt-0.5' : undefined}>{children}</div> : null}
      </div>
    </div>
  );
}

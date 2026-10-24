// src/shared/ui/tone-badge.tsx (A) — 배지 7톤 표준 (02 문서 7.2). 라벨이 의미를 전달하고 아이콘은 보조(aria-hidden)
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export const TONES = [
  'neutral',
  'brand',
  'positive',
  'caution',
  'attention',
  'info',
  'critical',
] as const;
export type Tone = (typeof TONES)[number];

/** 톤 → 토큰 클래스 (hex·기본 팔레트 없음) */
export const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-tone-neutral-bg text-tone-neutral-fg',
  brand: 'bg-tone-brand-bg text-tone-brand-fg',
  positive: 'bg-tone-positive-bg text-tone-positive-fg',
  caution: 'bg-tone-caution-bg text-tone-caution-fg',
  attention: 'bg-tone-attention-bg text-tone-attention-fg',
  info: 'bg-tone-info-bg text-tone-info-fg',
  critical: 'bg-tone-critical-bg text-tone-critical-fg',
};

export function toneClass(tone: Tone): string {
  return TONE_CLASS[tone];
}

export function ToneBadge({
  tone,
  icon: Icon,
  children,
  size = 'md',
  className,
  ...rest
}: {
  tone: Tone;
  icon?: LucideIcon;
  children: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
  'data-status'?: string;
  'data-ui-key'?: string;
}) {
  return (
    <span
      data-tone={tone}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-sm font-medium whitespace-nowrap',
        size === 'sm' ? 'h-5 px-1.5 text-xs' : 'h-6 px-2 text-xs',
        TONE_CLASS[tone],
        className,
      )}
      {...rest}
    >
      {Icon ? <Icon aria-hidden className={size === 'sm' ? 'size-3' : 'size-3.5'} /> : null}
      {children}
    </span>
  );
}

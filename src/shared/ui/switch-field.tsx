'use client';
// src/shared/ui/switch-field.tsx (A) — 라벨·설명이 붙은 켜기/끄기 (base-ui Switch: 키보드·스크린리더 지원)
import type { ComponentProps } from 'react';
import { Switch } from '@/shared/ui/switch';
import { cn } from '@/shared/lib/utils';

export function SwitchField({
  id,
  label,
  description,
  uiKey,
  className,
  ...switchProps
}: Omit<ComponentProps<typeof Switch>, 'id' | 'className'> & {
  id: string;
  label: string;
  description?: string;
  uiKey?: string;
  className?: string;
}) {
  const labelId = `${id}-label`;
  const descId = description ? `${id}-desc` : undefined;
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <Switch
        id={id}
        aria-labelledby={labelId}
        aria-describedby={descId}
        data-ui-key={uiKey}
        className="mt-0.5"
        {...switchProps}
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <label id={labelId} htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {description ? (
          <p id={descId} className="text-muted-foreground text-meta">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

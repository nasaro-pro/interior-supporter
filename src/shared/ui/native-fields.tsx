// src/shared/ui/native-fields.tsx (A) — 폼 제출(FormData)·GET 필터용 네이티브 select·checkbox (토큰 스타일)
// shadcn Select/Checkbox 는 대화형 화면에, 이 컴포넌트는 서버 액션 폼·검색 필터에 쓴다.
import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/utils';

export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive h-8 w-full min-w-0 rounded-lg border px-2 text-sm outline-none focus-visible:ring-3 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export function NativeCheckbox({
  label,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & { label: string }) {
  return (
    <label
      className={cn('inline-flex min-h-6 cursor-pointer items-center gap-2 text-sm', className)}
    >
      <input type="checkbox" className="accent-primary size-4 cursor-pointer" {...props} />
      <span>{label}</span>
    </label>
  );
}

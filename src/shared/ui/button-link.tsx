// src/shared/ui/button-link.tsx (A) — 버튼 모양의 링크 (next/link). 서버 컴포넌트에서도 쓸 수 있다
import type { ReactNode } from 'react';
import Link from 'next/link';
import type { VariantProps } from 'class-variance-authority';
import { buttonVariants } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';

export function ButtonLink({
  href,
  variant = 'default',
  size = 'default',
  className,
  children,
  ...rest
}: VariantProps<typeof buttonVariants> & {
  href: string;
  className?: string;
  children: ReactNode;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean;
  'data-ui-key'?: string;
  'aria-label'?: string;
  'aria-current'?: 'page' | 'step' | 'location' | 'true';
}) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)} {...rest}>
      {children}
    </Link>
  );
}

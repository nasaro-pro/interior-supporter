// src/shared/lib/utils.ts (A · 스타터 고정) — shadcn/ui 가 쓰는 클래스 병합 함수
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

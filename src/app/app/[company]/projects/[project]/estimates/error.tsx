'use client';
// 오류 상태 (ErrorState + 재시도 + 문의 코드) — 00 헌법 10.2 · 표준 RouteError. 탭 폴더 하나가 목록·상세를 함께 받는다
import { usePathname } from 'next/navigation';
import { RouteError } from '@/shared/ui/route-error';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const detail = /\/estimates\/[^/]+\/?$/.test(usePathname() ?? '');
  return <RouteError error={error} reset={reset} screenId={detail ? 'PM-19' : 'PM-09'} />;
}

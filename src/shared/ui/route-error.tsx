'use client';
// src/shared/ui/route-error.tsx (A) — 라우트 error.tsx 본문: 오류 + 다시 시도(reset) + 문의 코드(digest) (상태 6종)
// 원인은 서버 로그(digest)에 있다. 화면에는 문의 코드만 보여 준다 (헌법 7.4)
import { ErrorState } from '@/shared/ui/states';

export function RouteError({
  error,
  reset,
  screenId,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** 이 error.tsx 가 대신하는 화면 id (main 의 data-screen-id) */
  screenId?: string;
}) {
  return (
    <main data-screen-id={screenId} className="flex flex-col gap-6">
      <ErrorState errorRef={error.digest} onRetry={reset} />
    </main>
  );
}

// src/shared/lib/supabase/browser.ts (A) — 업로드 전용
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/shared/contracts/database.types';

/** uploadToSignedUrl 전용. 테이블 조회·RPC·auth 호출에 쓰지 않는다 (ADR-002). 브라우저에서는 싱글턴으로 동작 */
export function createBrowserSupabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

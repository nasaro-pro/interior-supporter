// src/shared/lib/supabase/server.ts (A)
import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/shared/contracts/database.types';

/** 외부 호출 시간 초과 (Supabase 연동, 03 문서 8장). supabase-js 는 기본 시간 초과가 없다 */
const fetchWithTimeout: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(10_000) });

export async function createServerSupabase() {
  const cookieStore = await cookies(); // Next 15+ : cookies() 는 비동기
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchWithTimeout },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // 의도적 무시 — '빈 catch 금지' 규칙의 문서화된 유일한 예외.
            // Server Component 렌더 중에는 쿠키를 쓸 수 없다(Server Action·Route Handler 에서는 정상 기록).
            // 세션 갱신 쿠키는 proxy.ts 가 매 요청 앞단에서 이미 기록한다.
          }
        },
      },
    },
  );
}

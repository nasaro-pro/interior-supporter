// src/shared/lib/supabase/server.ts (A)
import 'server-only';
import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/shared/contracts/database.types';

/** 외부 호출 시간 초과 (Supabase 연동, 03 문서 8장). supabase-js 는 기본 시간 초과가 없다 */
const fetchWithTimeout: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(10_000) });

/** 담당자의 고객 화면 미리보기 쿠키 (값 = 프로젝트 id). 설정 · 해제는 features/core/server/customer-preview.ts */
export const CUSTOMER_PREVIEW_COOKIE = 'is_customer_preview';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 고객 화면 미리보기 요청이면 그 프로젝트 id (아니면 null).
 * 조건: 쿠키 · 고객 화면(/portal/projects/<같은 id>) 페이지 렌더 · Server Action 아님.
 * 헤더를 받은 DB 는 '진짜 편집자 + 읽기 전용 조회'일 때만 고객 규칙으로 본다 (20261029000200_a_customer_preview.sql)
 */
export function customerPreviewTarget(
  cookieValue: string | undefined,
  pathname: string | null,
  isAction: boolean,
): string | null {
  if (!cookieValue || !UUID.test(cookieValue) || isAction || !pathname) return null;
  const prefix = `/portal/projects/${cookieValue}`;
  return pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}?`)
    ? cookieValue
    : null;
}

export async function createServerSupabase() {
  const cookieStore = await cookies(); // Next 15+ : cookies() 는 비동기
  const h = await headers();
  const preview = customerPreviewTarget(
    cookieStore.get(CUSTOMER_PREVIEW_COOKIE)?.value,
    h.get('x-pathname'),
    h.has('next-action'),
  );
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: fetchWithTimeout,
        ...(preview ? { headers: { 'x-customer-preview': preview } } : {}),
      },
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

// src/proxy.ts (A) — Next 16: middleware.ts → proxy.ts, Node 런타임
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function buildCsp(nonce: string): string {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL!; // https://<ref>.supabase.co
  const dev = process.env.NODE_ENV !== 'production';
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? ` 'unsafe-eval'` : ''}`,
    `style-src 'self' 'unsafe-inline'`, // 컴포넌트 인라인 style 속성(슬라이더 등) 허용
    `img-src 'self' blob: data: ${supabase}`, // /api/files 302 → 서명 URL, 업로드 미리보기 blob:
    `font-src 'self'`, // Pretendard next/font/local
    `connect-src 'self' ${supabase}`, // uploadToSignedUrl, PDF 바이트 fetch
    `media-src 'self' ${supabase}`,
    `frame-src 'self' ${supabase}`, // 견적 PDF 미리보기
    `worker-src 'self' blob:`, // pdfjs-dist 워커
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce);

  // 요청 헤더에 nonce·CSP 를 실어 보내면 Next 가 프레임워크 스크립트에 nonce 를 붙인다.
  // 세션 갱신으로 request.cookies 가 바뀌면 다시 복사해야 하므로 함수로 만든다.
  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set('x-nonce', nonce);
    headers.set('Content-Security-Policy', csp);
    // getAccessContext 가 미로그인 시 routes.login(next) 를 만들 때 쓰는 현재 경로 (표시·복귀용, 권한 판단에 쓰지 않음)
    headers.set('x-pathname', request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.next({ request: { headers } });
  };
  let response = forward();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = forward();
          for (const { name, value, options } of cookiesToSet)
            response.cookies.set(name, value, options);
        },
      },
    },
  );

  // createServerClient 와 getUser 사이에 다른 코드를 넣지 않는다 (세션이 엉뚱하게 끊기는 원인).
  // 권한 판단·리다이렉트는 하지 않는다 — 각 page/action 의 getAccessContext 가 담당.
  await supabase.auth.getUser();

  response.headers.set('Content-Security-Policy', csp);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) response.headers.set(k, v);
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }
  return response;
}

export const config = {
  matcher: [
    {
      source:
        '/((?!_next/static|_next/image|api/health|favicon.ico|fonts/|.*\\.(?:svg|png|jpg|jpeg|webp|ico|woff2)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};

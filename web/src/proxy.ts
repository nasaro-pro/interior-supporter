// src/proxy.ts — Next.js 16: 파일명·함수명 모두 proxy
import { NextResponse, type NextRequest } from "next/server";
import { resolvePortalHost } from "@/lib/config/hosts";

const PUBLIC_PREFIXES = [
  "/",
  "/login",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/terms",
  "/privacy",
  "/contact",
  "/pricing",
  "/invite",
];

/**
 * ARCHITECTURE.md 17.2 — 모든 요청에 requestId 를 부여한다.
 * 요청 헤더로 내려보내 서버 컴포넌트·액션이 읽고, 응답 헤더로도 돌려준다.
 */
function withRequestId(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  return response;
}

export async function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const host = (request.headers.get("host") ?? "").toLowerCase();

  // 1) 화이트라벨 커스텀 도메인은 '고객 영역 전용'이다 (관리자 경로는 플랫폼 도메인만)
  const branded = await resolvePortalHost(host); // { companyId } | null · 캐시 조회
  if (branded) {
    if (
      url.pathname.startsWith("/app") ||
      url.pathname.startsWith("/platform")
    ) {
      return NextResponse.redirect(
        new URL(url.pathname, process.env.NEXT_PUBLIC_APP_URL!),
      );
    }
    const allowed =
      url.pathname.startsWith("/portal") ||
      url.pathname.startsWith("/invite") ||
      PUBLIC_PREFIXES.some(
        (p) => url.pathname === p || url.pathname.startsWith(p + "/"),
      );
    if (!allowed) return NextResponse.redirect(new URL("/portal", request.url));
    return withRequestId(request);
  }

  // 2) 세션 쿠키가 아예 없는 보호 경로 → 로그인 화면 (UX 목적의 빠른 차단)
  const isProtected = ["/app", "/platform", "/portal", "/onboarding"].some(
    (p) => url.pathname.startsWith(p),
  );
  if (
    isProtected &&
    !request.cookies.has(
      process.env.SESSION_COOKIE_NAME ?? "better-auth.session_token",
    )
  ) {
    return NextResponse.redirect(
      new URL(
        `/login?next=${encodeURIComponent(url.pathname)}`,
        request.url,
      ),
    );
  }
  return withRequestId(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

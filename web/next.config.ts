import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { getEnv } from "./src/lib/config/env";

const env = getEnv();
const isProd = env.NODE_ENV === "production";

/**
 * ARCHITECTURE.md 14.2 — 전 경로에 보안 헤더를 붙인다.
 *
 * 텍스트 블록이 dangerouslySetInnerHTML 로 렌더되므로(9.3) sanitize-html 단독
 * 방어에 의존하지 않는다. 확정 지시는 되돌릴 수 없는 기록이라 클릭재킹 차단
 * (frame-ancestors)도 필수다.
 */
const csp = [
  "default-src 'self'",
  // Next 의 인라인 부트스트랩 때문에 'unsafe-inline' 이 필요하다.
  // nonce 기반으로 바꾸면 제거한다.
  "script-src 'self' 'unsafe-inline'" + (isProd ? "" : " 'unsafe-eval'"),
  "style-src 'self' 'unsafe-inline'",
  // 이미지는 전부 /api/files 내부 경로다 (ADR-11).
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'" + (env.NEXT_PUBLIC_SENTRY_DSN ? " https://*.sentry.io" : ""),
  "media-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  experimental: {
    // forbidden() / unauthorized() 는 이 플래그가 있어야 동작한다.
    // 없으면 403 경로가 forbidden.tsx 가 아니라 일반 오류 화면으로 떨어진다.
    // (node_modules/next/dist/docs/.../authInterrupts.md)
    authInterrupts: true,
  },
  images: {
    qualities: [60, 75],
    minimumCacheTTL: 14400,
    localPatterns: [
      { pathname: "/api/files/**", search: "?v=thumb" },
      { pathname: "/api/files/**", search: "?v=full" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default env.SENTRY_DSN
  ? withSentryConfig(nextConfig, { sourcemaps: { disable: true }, silent: true })
  : nextConfig;

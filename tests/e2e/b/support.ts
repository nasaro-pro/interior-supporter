// tests/e2e/b 공용 (B) — 통합 시드 계정 로그인 · 시드 id. 비밀번호는 E2E_SEED_PASSWORD (값 출력 없음)
// A-15: 화면 문구로 판정하지 않는다 — data-screen-id · data-ui-key · data-status · role 로 판정
import type { Browser, Page } from '@playwright/test';

export const PW = process.env.E2E_SEED_PASSWORD ?? '';
export const SLUG = 'studio-x';
export const P1 = '00000000-0000-4000-b000-000000000001';
/** seed-extra.mjs 보강 데이터 id (접두 00000000-0000-4000-9000-) */
export const sid = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, '0')}`;
export const SEED = {
  materialConfirmed: sid(301), // 포세린 타일 — 공개 + cust1 확정
  materialPublic: sid(302), // 원목 마루 — 공개
  materialPrivate: sid(303), // 수입 수전 — 비공개
  estimate: sid(401), // 본 공사 견적 — v1 공개(file 0007) / v2 비공개(file 0008)
  estimateV1File: sid(7),
  estimateV2File: sid(8),
} as const;

export type Account = 'owner-x' | 'pm1' | 'cust1' | 'cust2' | 'cust3';

export async function login(page: Page, who: Account) {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(`${who}@example.test`);
  await page.locator('input[name="password"]').fill(PW);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login')),
    page.locator('[data-ui-key="login-form-submit"]').click(),
  ]);
}

/** 로그인한 새 컨텍스트 (계정 둘을 번갈아 쓰는 확정 흐름용) */
export async function loginAs(browser: Browser, who: Account): Promise<Page> {
  const context = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage();
  await login(page, who);
  return page;
}

export const app = {
  materials: () => `/app/${SLUG}/projects/${P1}/materials`,
  material: (id: string) => `/app/${SLUG}/projects/${P1}/materials/${id}`,
  designs: () => `/app/${SLUG}/projects/${P1}/designs`,
  estimate: (id: string, v?: number) =>
    `/app/${SLUG}/projects/${P1}/estimates/${id}${v ? `?v=${v}` : ''}`,
  overview: () => `/app/${SLUG}/projects/${P1}/overview`,
};
export const portal = {
  material: (id: string) => `/portal/projects/${P1}/materials/${id}`,
  design: (id: string) => `/portal/projects/${P1}/designs/${id}`,
  estimate: (id: string, v?: number) =>
    `/portal/projects/${P1}/estimates/${id}${v ? `?v=${v}` : ''}`,
};

export const key = (k: string) => `[data-ui-key="${k}"]`;

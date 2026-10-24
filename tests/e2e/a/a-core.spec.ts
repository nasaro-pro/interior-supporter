// tests/e2e/a/a-core.spec.ts (A) — 공개·인증 진입 + 시드 계정 역할별 흐름 (dev Supabase + supabase/seed.sql 필요)
// 계정은 통합 시드(supabase/seed.sql 머리말)의 개발용 계정 — owner-x·pm1·pm2·cust1·field2 @example.test.
// 비밀번호는 E2E_SEED_PASSWORD 환경변수로 넘긴다 (코드·seed.sql 에 비밀값을 두지 않음, A-13).
// A-15: 화면 문구(한국어)로 판정하지 않는다 — data-screen-id·data-ui-key·role 로만 판정 (ko/en 무관)
import { expect, test, type Page } from '@playwright/test';

const PW = process.env.E2E_SEED_PASSWORD ?? '';
const P1 = '00000000-0000-4000-b000-000000000001';
const P2 = '00000000-0000-4000-b000-000000000002';
const Q1 = '00000000-0000-4000-b000-000000000003';
/** 통합 시드 계정 (seed.sql 과 같은 목록) */
const SEED = {
  ownerX: 'owner-x@example.test',
  pm1: 'pm1@example.test',
  pm2: 'pm2@example.test',
  cust1: 'cust1@example.test',
  field2: 'field2@example.test',
} as const;

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(PW);
  await page.locator('[data-ui-key="login-form-submit"]').click();
  // 로그인 후 영역 화면으로 이동할 때까지 기다린다 (문구가 아니라 URL 로 판정)
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

test('PUB-01 랜딩·IF-health', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('main[data-screen-id="PUB-01"]')).toBeVisible();
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});

test('TC-910 보안 헤더·CSP', async ({ request }) => {
  const res = await request.get('/login');
  const h = res.headers();
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
});

test('TC-002 로그인 실패는 계정 존재 여부를 드러내지 않는다', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#login-email').fill('nobody@example.test');
  await page.locator('#login-password').fill('wrong-password-1');
  await page.locator('[data-ui-key="login-form-submit"]').click();
  await expect(page.locator('main[data-screen-id="AUTH-01"] [role="alert"]')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test.describe('시드 계정 흐름', () => {
  test.skip(!PW, 'E2E_SEED_PASSWORD 미설정 — seed.sql 적용 후 실행');

  test('A-T01 PM-01 → PM-03 중간 빈 화면 없이 진입', async ({ page }) => {
    await login(page, SEED.ownerX);
    await expect(page.locator('main[data-screen-id="PM-01"]')).toBeVisible();
    await page.locator(`[data-ui-key="project-list-open"]`).first().click();
    await expect(page.locator('main[data-screen-id="PM-03"]')).toBeVisible();
  });

  test('A-T03 다른 업체·미배정 프로젝트 직접 URL → 404 (존재 숨김)', async ({ page }) => {
    await login(page, SEED.pm2);
    await page.goto(`/app/studio-x/projects/${P1}/overview`);
    await expect(page.locator('main[data-screen-id="SYS-404"]')).toBeVisible();
    await page.goto(`/app/studio-y/projects/${Q1}/overview`);
    await expect(page.locator('main[data-screen-id="SYS-404"]')).toBeVisible();
  });

  test('A-T05 PM 은 업체 설정 동작 불가 (권한 없음 안내)', async ({ page }) => {
    await login(page, SEED.pm1);
    await page.goto('/app/studio-x/settings/members');
    await expect(
      page.locator('main[data-screen-id="PM-62"] [data-ui-key="state-forbidden"][role="alert"]'),
    ).toBeVisible();
    await expect(page.locator('[data-ui-key="member-invite-open"]')).toHaveCount(0);
  });

  test('A-T08 고객은 공개 프로젝트만, 비공개 P2 직접 URL → 404', async ({ page }) => {
    await login(page, SEED.cust1);
    await page.goto('/portal/projects');
    await expect(page.locator('main[data-screen-id="CL-01"]')).toBeVisible();
    await page.goto(`/portal/projects/${P2}/home`);
    await expect(page.locator('main[data-screen-id="SYS-404"]')).toBeVisible();
  });

  test('TC-018 기간 만료 시공팀(F2)은 시공팀 영역 진입 불가', async ({ page }) => {
    await login(page, SEED.field2);
    await page.goto('/field/photos');
    await expect(page.locator('main[data-screen-id="SYS-404"]')).toBeVisible();
  });
});

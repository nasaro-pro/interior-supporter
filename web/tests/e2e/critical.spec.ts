import { expect, test, type Page } from "@playwright/test";
import { seedCanonical, E2E_PASSWORD, DRAFT_MARKER } from "../fixtures/seed";
import { messages } from "@/lib/messages";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  // 실패 원인을 타임아웃 뒤에 숨기지 않는다. 다음 회귀 때 바로 보이게 한다.
  await expect(page.getByText(messages.loginFailed)).toHaveCount(0);
  await expect(page.getByText(messages.rateLimited)).toHaveCount(0);
  // dev 서버는 첫 요청에서 라우트를 컴파일한다. 콜드 스타트를 견딜 만큼 넉넉히 준다.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });
}

test("T-01 업체 A 스태프가 업체 B 프로젝트 URL 접근 @critical", async ({ page }) => {
  const seed = await seedCanonical({ withPasswords: true });
  await login(page, seed.adminA.email, E2E_PASSWORD);
  const res = await page.goto(
    `/app/${seed.companyB.slug}/projects/${seed.projectB1.id}/overview`,
  );
  expect(res?.status() === 403 || (await page.getByText(messages.forbidden).count()) > 0).toBe(true);
});

test("T-03 고객 계정으로 /app 접근 @critical", async ({ page }) => {
  const seed = await seedCanonical({ withPasswords: true });
  await login(page, seed.custA.email, E2E_PASSWORD);
  const res = await page.goto(`/app/${seed.companyA.slug}`);
  expect(res?.status() === 403 || (await page.getByText(messages.forbidden).count()) > 0).toBe(true);
});

test("T-04 접근 없는 계정의 포털 @critical", async ({ page }) => {
  const seed = await seedCanonical({ withPasswords: true });
  await login(page, seed.stranger.email, E2E_PASSWORD);
  const res = await page.goto(`/portal/${seed.projectA1.id}/home`);
  expect(res?.status() === 403 || (await page.getByText(messages.forbidden).count()) > 0).toBe(true);
});

test("T-08 초안 콘텐츠는 고객 화면에 없다", async ({ page }) => {
  const seed = await seedCanonical({ withPasswords: true });
  await login(page, seed.custA.email, E2E_PASSWORD);
  await page.goto(`/portal/${seed.projectA1.id}/design`);
  await expect(page.getByText(DRAFT_MARKER)).toHaveCount(0);
});

test("T-12 PM이 타인 담당 프로젝트 수정 시도", async ({ page }) => {
  const seed = await seedCanonical({ withPasswords: true });
  await login(page, seed.pmA.email, E2E_PASSWORD);
  const res = await page.goto(
    `/app/${seed.companyA.slug}/projects/${seed.projectA1.id}/overview`,
  );
  expect(res?.status() === 403 || (await page.getByText(messages.forbidden).count()) > 0).toBe(true);
});

test("T-17 멤버십 회수 직후 요청이 차단된다", async ({ page }) => {
  const seed = await seedCanonical({ withPasswords: true });
  await login(page, seed.adminA.email, E2E_PASSWORD);
  await page.goto(`/app/${seed.companyA.slug}/admin/members`);
  const row = page.locator("tr", { hasText: seed.pmRevoke.email });
  await row.getByRole("button", { name: messages.deactivateMember }).click();
  await expect(row.getByText(messages.memberInactive)).toBeVisible();
  await page.context().clearCookies();
  await login(page, seed.pmRevoke.email, E2E_PASSWORD);
  const res = await page.goto(`/app/${seed.companyA.slug}/projects`);
  expect(res?.status() === 403 || (await page.getByText(messages.forbidden).count()) > 0).toBe(true);
});

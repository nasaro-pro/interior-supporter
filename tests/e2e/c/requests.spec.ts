// C-T01 · C-T02 — 요청 생성 → PM 답변·상태 → 고객 정정, 원문 보존, 다른 고객 차단 (REQ-200~205, INT-05)
import { expect, test } from '@playwright/test';
import { hasSeed, loginAs, seed, unique } from './support/env';

test.skip(!hasSeed, 'E2E_SEED_PASSWORD 미설정 — 통합 시드(seed.sql + seed-extra) 적용 후 실행');
test.skip(({ isMobile }) => isMobile, '흐름 검증은 데스크톱 1회');

test('C-T01 요청 생성 → 답변 → 정정, 원문 불변·시각순', async ({ browser }) => {
  const title = unique('E2E 거실 조명 위치');
  const body = '거실 조명을 창가 쪽으로 옮길 수 있을까요?';

  // 고객 U1: 작성
  const u1 = await loginAs(browser, 'U1');
  await u1.goto(`/portal/projects/${seed.p1}/requests`);
  await expect(u1.locator('main[data-screen-id="CL-06"]:not([aria-busy])')).toBeVisible();
  await u1.locator('[data-ui-key="request-create-open"]').click();
  await u1.locator('#request-title').fill(title);
  await u1.locator('#request-body').fill(body);
  await u1.locator('[data-ui-key="request-form-submit"]').click();
  await u1.locator('[data-ui-key="request-submit-confirm"]').click();
  await expect(u1.locator('main[data-screen-id="CL-16"]:not([aria-busy])')).toBeVisible();
  const requestUrl = u1.url();
  const requestId = requestUrl.split('/').pop()!;
  await expect(u1.locator('[data-kind="original"]')).toContainText(body);

  // PM1: 목록에서 찾아 답변 + 처리 중
  const pm = await loginAs(browser, 'PM1');
  await pm.goto(`/app/${seed.slug}/projects/${seed.p1}/requests?q=${encodeURIComponent(title)}`);
  await expect(pm.locator(`[data-key="${requestId}"]`)).toContainText('답변 대기');
  await pm.goto(`/app/${seed.slug}/projects/${seed.p1}/requests/${requestId}`);
  await pm.locator('#request-reply-body').fill('가능합니다. 다음 주에 위치를 표시해 드릴게요.');
  await pm.locator('[data-ui-key="request-reply-submit"]').click();
  await expect(pm.locator('[data-kind="reply"]')).toHaveCount(1);
  await pm.locator('#request-status-to').selectOption('in_progress');
  await pm.locator('[data-ui-key="request-status-apply"]').click();
  await expect(pm.getByText('처리 중').first()).toBeVisible();

  // 고객 U1: 답변 확인 → 정정 추가, 원문은 그대로
  await u1.goto(requestUrl);
  await expect(u1.locator('[data-kind="reply"]')).toHaveCount(1);
  await u1.locator('#request-correction-body').fill('창가에서 30cm 떨어진 곳이면 좋겠습니다.');
  await u1.locator('[data-ui-key="request-correction-submit"]').click();
  await expect(u1.locator('[data-kind="correction"]')).toHaveCount(1);
  const kinds = await u1
    .locator('[data-kind]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')));
  expect(kinds).toEqual(['original', 'reply', 'correction']);
  await expect(u1.locator('[data-kind="original"]')).toContainText(body);
  // 원문 수정 UI 없음
  await expect(u1.locator('[data-ui-key="request-edit"]')).toHaveCount(0);
});

test('C-T02 다른 고객(U2)은 U1 의 요청을 볼 수 없다 (목록·직접 URL 404)', async ({ browser }) => {
  const u2 = await loginAs(browser, 'U2');
  await u2.goto(`/portal/projects/${seed.p1}/requests`);
  await expect(u2.locator('main[data-screen-id="CL-06"]:not([aria-busy])')).toBeVisible();
  // 본인 요청(시드 cust2 요청)은 보이고, U1 요청은 목록에 없다
  await expect(u2.locator(`[data-key="${seed.requestU2}"]`)).toHaveCount(1);
  await expect(u2.locator(`[data-key="${seed.requestU1}"]`)).toHaveCount(0);
  const res = await u2.goto(`/portal/projects/${seed.p1}/requests/${seed.requestU1}`);
  expect(res?.status()).toBe(404);
});

test('C-T02 초대되지 않은 고객(U3)은 P1 요청 화면에 접근할 수 없다', async ({ browser }) => {
  const u3 = await loginAs(browser, 'U3');
  const res = await u3.goto(`/portal/projects/${seed.p1}/requests`);
  expect(res?.status()).toBe(404);
});

test('C-T02 다른 업체 소유자(OY)는 X 프로젝트 요청 화면에 접근할 수 없다', async ({ browser }) => {
  const oy = await loginAs(browser, 'OY');
  const res = await oy.goto(`/app/${seed.slug}/projects/${seed.p1}/requests`);
  expect(res?.status()).toBe(404);
});

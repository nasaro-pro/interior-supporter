// C-T08 · C-T09 — 일요일 시작 월간, 수정 후 프로젝트·전체 캘린더 일치, 고객 공개 범위 (REQ-230~233, INT-07)
import { expect, test } from '@playwright/test';
import { hasSeed, kstMonth, loginAs, seed, unique } from './support/env';

test.skip(!hasSeed, 'E2E_SEED_PASSWORD 미설정 — 통합 시드(seed.sql + seed-extra) 적용 후 실행');

test('C-T08 일정 등록·수정 → 프로젝트 일정·전체 캘린더 같은 값', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', '월간 그리드는 md 이상');
  const pm = await loginAs(browser, 'PM1');
  const base = `/app/${seed.slug}/projects/${seed.p1}/schedule`;
  const title = unique('E2E 도장');
  await pm.goto(base);
  await expect(
    pm.locator('main[data-screen-id="PM-08"]:not([aria-busy]) thead th').first(),
  ).toHaveText('일');

  await pm.locator('[data-ui-key="schedule-create-open"]').click();
  await pm.locator('#schedule-title').fill(title);
  await pm.locator('#schedule-start-time').fill('09:00');
  await pm.locator('#schedule-end-time').fill('08:00');
  await pm.locator('[data-ui-key="schedule-form-submit"]').click();
  await expect(pm.getByText('종료 시각은 시작 시각 이후여야 합니다.')).toBeVisible();
  await pm.locator('#schedule-end-time').fill('17:30');
  await pm.locator('[data-ui-key="schedule-form-submit"]').click();
  await expect(pm.locator('main[data-screen-id="PM-18"]:not([aria-busy])')).toContainText(title);
  const detailPath = new URL(pm.url()).pathname;
  const eventId = detailPath.split('/').pop()!;

  // 수정: 시작 시각 변경
  await pm.locator('[data-ui-key="schedule-edit-open"]').click();
  await pm.locator('#schedule-start-time').fill('10:00');
  await pm.locator('[data-ui-key="schedule-form-submit"]').click();
  await expect(pm.locator('main[data-screen-id="PM-18"]:not([aria-busy])')).toContainText(
    '10:00 ~ 17:30',
  );

  // 프로젝트 일정 칩과 전체 캘린더 칩이 같은 일정 id·시각
  await pm.goto(base);
  const chip = pm.locator(`a[data-key="${eventId}"]`).first();
  await expect(chip).toContainText('10:00');
  await pm.goto(`/app/${seed.slug}/calendar`);
  const calChip = pm
    .locator(`main[data-screen-id="PM-30"]:not([aria-busy]) a[data-key="${eventId}"]`)
    .first();
  await expect(calChip).toContainText('10:00');
  await expect(calChip).toContainText(seed.p1Name);
  // C-T09 TR-05: 전체 캘린더 → 해당 프로젝트 PM-18, 뒤로가기 시 보던 달·필터 복원 (URL 상태)
  await pm.goto(`/app/${seed.slug}/calendar?month=${kstMonth()}&projects=${seed.p1}`);
  const calUrl = pm.url();
  await pm
    .locator(`main[data-screen-id="PM-30"]:not([aria-busy]) a[data-key="${eventId}"]`)
    .first()
    .click();
  await expect(pm).toHaveURL(new RegExp(`${detailPath}$`));
  await pm.goBack();
  await expect(pm).toHaveURL(calUrl);
});

test('C-T09 고객은 공개 일정만, 비공개 일정 직접 URL 은 404', async ({ browser }) => {
  const u1 = await loginAs(browser, 'U1');
  expect(
    (await u1.goto(`/portal/projects/${seed.p1}/schedule/${seed.eventPublic}`))?.status(),
  ).toBe(200);
  expect(
    (await u1.goto(`/portal/projects/${seed.p1}/schedule/${seed.eventPrivate}`))?.status(),
  ).toBe(404);
  await u1.goto(`/portal/projects/${seed.p1}/schedule`);
  await expect(u1.locator(`a[data-key="${seed.eventPrivate}"]`)).toHaveCount(0);
});

test('360px 가로 스크롤 없음 (NFR-006)', async ({ browser }) => {
  const pm = await loginAs(browser, 'PM1');
  await pm.setViewportSize({ width: 360, height: 780 });
  for (const path of [
    `/app/${seed.slug}/projects/${seed.p1}/requests`,
    `/app/${seed.slug}/projects/${seed.p1}/photos`,
    `/app/${seed.slug}/projects/${seed.p1}/schedule`,
    `/app/${seed.slug}/calendar`,
  ]) {
    await pm.goto(path);
    const overflow = await pm.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

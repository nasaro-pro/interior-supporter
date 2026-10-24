// C-T03 · C-T04 — PM 다중 업로드의 부분 실패·재시도, 고객은 공개 사진·허용 다운로드만 (REQ-210~213, INT-06)
import { expect, test } from '@playwright/test';
import { hasSeed, loginAs, PNG_1X1, seed, unique } from './support/env';

test.skip(!hasSeed, 'E2E_SEED_PASSWORD 미설정 — 통합 시드(seed.sql + seed-extra) 적용 후 실행');
test.skip(({ isMobile }) => isMobile, '흐름 검증은 데스크톱 1회');

test('C-T03 3장 중 1장 업로드 실패 → 실패분만 재시도 → 최종 3장', async ({ browser }) => {
  const pm = await loginAs(browser, 'PM1');
  const list = `/app/${seed.slug}/projects/${seed.p1}/photos`;
  const description = unique('E2E 부분 실패');
  // 첫 번째 서명 업로드 요청만 끊는다 (네트워크 실패 주입, NFR-008)
  let aborted = false;
  await pm.route('**/storage/v1/object/upload/sign/**', async (route) => {
    if (!aborted) {
      aborted = true;
      return route.abort('failed');
    }
    return route.continue();
  });

  await pm.goto(`${list}?mode=upload`);
  await pm.locator('#photo-upload-input').setInputFiles([
    { name: 'a.png', mimeType: 'image/png', buffer: PNG_1X1 },
    { name: 'b.png', mimeType: 'image/png', buffer: PNG_1X1 },
    { name: 'c.png', mimeType: 'image/png', buffer: PNG_1X1 },
  ]);
  await pm.locator('#photo-upload-phase').selectOption('tile');
  await pm.locator('#photo-upload-desc').fill(description);
  await pm.locator('[data-ui-key="photo-upload-submit"]').click();

  await expect(pm.locator('li[data-stage="failed"]')).toHaveCount(1);
  await expect(pm.locator('li[data-stage="done"]')).toHaveCount(2);
  await pm.locator('[data-ui-key="photo-upload-retry"]').click();
  // 모두 성공하면 입력 상태가 끝나고 목록으로 (?mode 제거)
  await expect(pm).toHaveURL(new RegExp(`${list}$`));
  await pm.reload();
  // 목록은 30개 단위라 전체 개수 대신 이번에 올린 고유 설명의 카드 3장을 센다 (다른 실행이 남긴 사진과 무관)
  await expect(pm.locator('li[data-key]').filter({ hasText: description })).toHaveCount(3);
});

test('C-T04 고객은 비공개 사진·파일에 접근할 수 없고, 공개 전환 후에만 본다', async ({
  browser,
}) => {
  const pm = await loginAs(browser, 'PM1');
  const list = `/app/${seed.slug}/projects/${seed.p1}/photos`;
  await pm.goto(`${list}?mode=upload`);
  await pm
    .locator('#photo-upload-input')
    .setInputFiles([{ name: 'private.png', mimeType: 'image/png', buffer: PNG_1X1 }]);
  const description = unique('E2E 비공개');
  await pm.locator('#photo-upload-desc').fill(description);
  await pm.locator('[data-ui-key="photo-upload-submit"]').click();
  await expect(pm).toHaveURL(new RegExp(`${list}$`));
  await pm.reload();
  // C-10: 고유 설명으로 이번에 올린 카드만 집는다 (.first() 로 다른 비공개 사진을 잡지 않도록)
  const card = pm.locator('li[data-key]').filter({ hasText: description });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('비공개');
  const photoId = (await card.getAttribute('data-key'))!;
  const src = (await card.locator('img').getAttribute('src'))!;
  const fileId = src.split('/').pop()!.split('?')[0]!;

  const u1 = await loginAs(browser, 'U1');
  expect((await u1.goto(`/portal/projects/${seed.p1}/photos/${photoId}`))?.status()).toBe(404);
  const file = await u1.request.get(`/api/files/${fileId}`, { maxRedirects: 0 });
  expect(file.status()).toBe(404);
  expect(file.headers()['cache-control']).toContain('no-store');

  // PM 이 공개 → 고객 상세 열람 가능
  await pm.goto(`${list}/${photoId}`);
  await pm.locator('[data-ui-key="photo-publish-toggle"]').click();
  await expect(
    pm.locator(
      'main[data-screen-id="PM-17"]:not([aria-busy]) [data-ui-key="photo-publish-toggle"]',
    ),
  ).toContainText('비공개로 전환');
  const res = await u1.goto(`/portal/projects/${seed.p1}/photos/${photoId}`);
  expect(res?.status()).toBe(200);
  await expect(u1.locator('main[data-screen-id="CL-17"]:not([aria-busy])')).toBeVisible();
});

test('C-T04 시드: 고객은 공개 사진만 열람, 시공팀이 올린 비공개 사진은 404', async ({
  browser,
}) => {
  const u1 = await loginAs(browser, 'U1');
  expect((await u1.goto(`/portal/projects/${seed.p1}/photos/${seed.photoPublic}`))?.status()).toBe(
    200,
  );
  await expect(u1.locator('main[data-screen-id="CL-17"]:not([aria-busy])')).toBeVisible();
  expect(
    (await u1.goto(`/portal/projects/${seed.p1}/photos/${seed.photoField1Private}`))?.status(),
  ).toBe(404);
  await u1.goto(`/portal/projects/${seed.p1}/photos`);
  await expect(u1.locator(`li[data-key="${seed.photoField1Private}"]`)).toHaveCount(0);
});

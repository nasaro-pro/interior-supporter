// C-T05 · C-T06 · C-T07 — 시공팀 현장 선택·차단·업로드 (REQ-220~222, TR-08)
import { expect, test } from '@playwright/test';
import { hasSeed, loginAs, PNG_1X1, seed, unique } from './support/env';

test.skip(!hasSeed, 'E2E_SEED_PASSWORD 미설정 — 통합 시드(seed.sql + seed-extra) 적용 후 실행');
test.skip(({ isMobile }) => isMobile, '흐름 검증은 데스크톱 1회');

test('C-T05 현장 1개(F1)는 자동 선택, 여러 개(F3)는 선택 전 업로드 불가', async ({ browser }) => {
  const f1 = await loginAs(browser, 'F1');
  await f1.goto('/field/photos');
  await expect(f1.locator('main[data-screen-id="FW-01"]:not([aria-busy])')).toContainText(
    seed.p1Name,
  );
  await expect(f1.locator('[data-ui-key="photo-upload-open"]')).toBeEnabled();

  const f3 = await loginAs(browser, 'F3');
  await f3.goto('/field/photos');
  await expect(f3.locator('[data-ui-key="field-site-select"]')).toBeVisible();
  await expect(f3.locator('[data-ui-key="photo-upload-open"]')).toBeDisabled();
  await f3.locator('[data-ui-key="field-site-select"]').selectOption(seed.p2);
  await f3.locator('[data-ui-key="field-site-apply"]').click();
  await expect(f3).toHaveURL(new RegExp(`project=${seed.p2}`));
  await expect(f3.locator('[data-ui-key="photo-upload-open"]')).toBeEnabled();
});

test('C-T06 기간 만료(F2)·회수(F4)는 조회·상세·다운로드 차단, 다른 현장 id 는 404', async ({
  browser,
}) => {
  // 기준 사진: F1 이 P1 에 고유 설명으로 직접 올린 사진의 id·파일 id (C-10: .first() 대신 고유 문구로 특정)
  const f1 = await loginAs(browser, 'F1');
  const description = unique('E2E 차단 기준');
  await f1.goto(`/field/photos?project=${seed.p1}&upload=1`);
  await f1
    .locator('#photo-upload-input')
    .setInputFiles([{ name: 'base.png', mimeType: 'image/png', buffer: PNG_1X1 }]);
  await f1.locator('#photo-upload-desc').fill(description);
  await f1.locator('[data-ui-key="photo-upload-submit"]').click();
  await expect(f1).toHaveURL(new RegExp(`/field/photos\\?project=${seed.p1}$`));
  await f1.reload();
  const card = f1.locator('li[data-key]').filter({ hasText: description });
  await expect(card).toHaveCount(1);
  const photoId = await card.getAttribute('data-key');
  const src = await card.locator('img').getAttribute('src');
  const fileId = src?.split('/').pop()?.split('?')[0];
  expect(photoId).toBeTruthy();
  expect(fileId).toBeTruthy();

  for (const who of ['F2', 'F4'] as const) {
    const page = await loginAs(browser, who);
    // 유효 배정이 없으면 시공팀 영역 자체가 없는 화면 (A field 레이아웃 404, TC-018) — 업로드 버튼도 없다
    expect((await page.goto('/field/photos'))?.status(), `${who} /field/photos`).toBe(404);
    await expect(page.locator('[data-ui-key="photo-upload-open"]')).toHaveCount(0);
    expect((await page.goto(`/field/photos?project=${seed.p1}`))?.status()).toBe(404);
    if (photoId && fileId) {
      expect((await page.goto(`/field/photos/${photoId}?project=${seed.p1}`))?.status()).toBe(404);
      const file = await page.request.get(`/api/files/${fileId}`, { maxRedirects: 0 });
      expect(file.status(), `${who} 파일 다운로드`).toBe(404);
    }
  }

  expect((await f1.goto(`/field/photos?project=${seed.p2}`))?.status()).toBe(404);
  expect((await f1.goto(`/field/photos?project=${seed.q1}`))?.status()).toBe(404);
});

test('C-T07 시공팀 업로드 → 같은 현장 목록 갱신, 비공개 저장', async ({ browser }) => {
  const f1 = await loginAs(browser, 'F1');
  const description = unique('E2E 시공팀');
  await f1.goto(`/field/photos?project=${seed.p1}&upload=1`);
  await expect(f1.getByText(`올릴 현장: ${seed.p1Name}`)).toBeVisible();
  await expect(f1.locator('#photo-upload-public')).toHaveCount(0); // 공개 입력 없음
  await f1
    .locator('#photo-upload-input')
    .setInputFiles([{ name: 'field.png', mimeType: 'image/png', buffer: PNG_1X1 }]);
  await f1.locator('#photo-upload-desc').fill(description);
  await f1.locator('[data-ui-key="photo-upload-submit"]').click();
  await expect(f1).toHaveURL(new RegExp(`/field/photos\\?project=${seed.p1}$`));
  await f1.reload();
  const card = f1.locator('li[data-key]').filter({ hasText: description });
  await expect(card).toContainText('비공개');

  // PM 화면에서도 비공개 (업로드 ≠ 공개 승인)
  const pm = await loginAs(browser, 'PM1');
  await pm.goto(`/app/${seed.slug}/projects/${seed.p1}/photos`);
  await expect(pm.locator('li[data-key]').filter({ hasText: description })).toContainText('비공개');
});

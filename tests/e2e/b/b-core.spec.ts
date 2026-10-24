// tests/e2e/b/b-core.spec.ts (B) — 도안·자재·견적·파일 핵심 흐름 (통합 dev 시드 + seed-extra 필요)
// 판정은 data-screen-id · data-ui-key · data-status · role · HTTP 상태로만 한다 (문구·언어 무관, A-15)
// 상태를 바꾸는 테스트는 끝에서 되돌린다(자재 단가·적용 위치). 확정 기록은 지울 수 없으므로 마지막 상태를 '확정'으로 맞춘다
import { expect, test, type Page } from '@playwright/test';
import { app, key, login, loginAs, P1, portal, PW, SEED } from './support';

test.skip(!PW, 'E2E_SEED_PASSWORD 미설정 — 통합 시드 적용 후 실행');

// 스트리밍 중에는 loading.tsx 의 main(aria-busy) 과 본문 main 이 잠시 함께 있다 → 본문만 잡는다
const screen = (page: Page, id: string) =>
  page.locator(`main[data-screen-id="${id}"]:not([aria-busy="true"])`);

test.describe('자재 전환 TR-02~04', () => {
  test('개요 → 자재 탭(D3) → 상세(D4) → Sheet 수정 후에도 같은 D4 (D5 없음)', async ({ page }) => {
    await login(page, 'pm1');
    await page.goto(app.overview());
    await expect(screen(page, 'PM-03')).toBeVisible();

    // TR-02: 자재 탭
    await page.locator(key('project-tab-materials-link')).click();
    await expect(screen(page, 'PM-05')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/projects/${P1}/materials$`));

    // TR-03: 목록 항목 → 상세 (비공개 자재 303 — 확정 상태와 무관한 필드만 바꾼다)
    await page.locator(`[data-key="${SEED.materialPrivate}"] ${key('material-list-item')}`).click();
    await expect(screen(page, 'PM-15')).toBeVisible();
    const detailUrl = page.url();
    expect(detailUrl).toContain(`/materials/${SEED.materialPrivate}`);

    // TR-04: 수정 Sheet → 저장 → 같은 D4 에 머문다
    const note = `E2E 위치 ${Date.now().toString(36)}`;
    await editLocationNote(page, note);
    await expect(page).toHaveURL(detailUrl);
    await expect(screen(page, 'PM-15')).toContainText(note);

    // 되돌리기
    await editLocationNote(page, '');
    await expect(screen(page, 'PM-15')).not.toContainText(note);
  });

  test('모바일 폭(360)에서 상세·Sheet 가 가로로 넘치지 않고 Sheet 는 전체 화면', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await login(page, 'pm1');
    await page.goto(app.material(SEED.materialPrivate));
    await expect(screen(page, 'PM-15')).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(false);
    await page.locator(key('material-edit-open')).click();
    const sheet = page.locator(key('material-edit-sheet'));
    await expect(sheet).toBeVisible();
    const box = await sheet.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(359);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  });
});

test.describe('견적 B-T09·B-T10 · 파일 TC-903', () => {
  test('고객: 비공개 버전 직접 링크는 404, v1 다운로드 링크는 v1 파일', async ({ page }) => {
    await login(page, 'cust1');
    // B-T09: 비공개 v2 직접 링크 → 실제 404 (존재 숨김)
    const res = await page.goto(portal.estimate(SEED.estimate, 2));
    expect(res?.status()).toBe(404);
    await expect(screen(page, 'SYS-404')).toBeVisible();

    // B-T10: v1 — 미리보기·다운로드가 같은 버전 파일
    await page.goto(portal.estimate(SEED.estimate, 1));
    await expect(screen(page, 'CL-19')).toBeVisible();
    const href = await page.locator(key('estimate-download')).getAttribute('href');
    expect(href).toBe(`/api/files/${SEED.estimateV1File}?download=1`);
    // 견적에는 확정·승인 버튼이 없다
    await expect(page.locator('[data-ui-key$="-confirm-open"]')).toHaveCount(0);
    // 고객 화면에는 공개 전환·보관 버튼이 없다
    await expect(page.locator(key('estimate-version-publish'))).toHaveCount(0);
    await expect(page.locator(key('estimate-archive'))).toHaveCount(0);
  });

  test('PM: 버전 선택(?v=N)과 다운로드 파일이 일치한다', async ({ page }) => {
    await login(page, 'pm1');
    await page.goto(app.estimate(SEED.estimate, 2));
    await expect(screen(page, 'PM-19')).toBeVisible();
    await expect(page.locator(key('estimate-download'))).toHaveAttribute(
      'href',
      `/api/files/${SEED.estimateV2File}?download=1`,
    );
    await expect(page.locator(key('estimate-version-select'))).toHaveValue('2');
  });

  test('TC-903: 다운로드는 302 + no-store, 비로그인·비공개 파일은 404', async ({
    page,
    browser,
  }) => {
    await login(page, 'cust1');
    const ok = await page.request.get(`/api/files/${SEED.estimateV1File}?download=1`, {
      maxRedirects: 0,
    });
    expect(ok.status()).toBe(302);
    expect(ok.headers()['cache-control']).toContain('no-store');
    expect(ok.headers()['location']).toBeTruthy();

    // 고객은 비공개 버전 파일을 받을 수 없다 (존재 숨김 404)
    const hidden = await page.request.get(`/api/files/${SEED.estimateV2File}?download=1`, {
      maxRedirects: 0,
    });
    expect(hidden.status()).toBe(404);

    // 비로그인 → 로그인 화면 리다이렉트가 아닌 404 + no-store
    const anon = await browser.newContext();
    const res = await anon.request.get(`/api/files/${SEED.estimateV1File}?download=1`, {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(404);
    expect(res.headers()['cache-control']).toContain('no-store');
    await anon.close();
  });
});

test.describe('도안 A/B 비교 B-T03·B-T04', () => {
  test('비교 이미지 2개인 "거실 도안": 16:10 · 키보드 1%/10%/Home/End · aria-valuetext', async ({
    page,
  }) => {
    await login(page, 'pm1');
    await page.goto(app.designs());
    await expect(screen(page, 'PM-04')).toBeVisible();
    // 시드 도안 id 는 RPC 가 만든 값이라 목록에서 찾는다
    await page.locator(key('design-list-item')).filter({ hasText: '거실 도안' }).first().click();
    await expect(screen(page, 'PM-14')).toBeVisible();

    const frame = page.getByTestId('compare-frame');
    const box = await frame.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width / box!.height).toBeCloseTo(1.6, 1);

    const handle = page.locator(key('design-compare-handle'));
    await expect(handle).toBeVisible();
    await expect(handle).toHaveAttribute('role', 'slider');
    await expect(handle).toHaveAttribute('aria-valuenow', '50');
    await expect(handle).toHaveAttribute('aria-valuetext', /A 50% \/ B 50%/);

    await handle.focus();
    await page.keyboard.press('ArrowRight');
    await expect(handle).toHaveAttribute('aria-valuenow', '51');
    await page.keyboard.press('Shift+ArrowRight');
    await expect(handle).toHaveAttribute('aria-valuenow', '61');
    await page.keyboard.press('ArrowLeft');
    await expect(handle).toHaveAttribute('aria-valuenow', '60');
    await page.keyboard.press('Home');
    await expect(handle).toHaveAttribute('aria-valuenow', '0');
    await page.keyboard.press('End');
    await expect(handle).toHaveAttribute('aria-valuenow', '100');
    await expect(handle).toHaveAttribute('aria-valuetext', /A 100% \/ B 0%/);
    // A 레이어는 clip-path 로만 노출 범위가 바뀐다 (이미지 크기 불변)
    await expect(page.getByTestId('compare-a')).toHaveAttribute('style', /inset\(0(px)? 0%/);

    // A 와 같은 이미지는 B 에서 고를 수 없다
    const aValue = await page.locator(key('design-compare-select-a')).inputValue();
    await expect(
      page.locator(`${key('design-compare-select-b')} option[value="${aValue}"]`),
    ).toHaveAttribute('disabled', '');
  });

  test('고객: 과거 버전·편집·미확정 배지가 보이지 않는다', async ({ page }) => {
    await login(page, 'cust2');
    await page.goto(`/portal/projects/${P1}/designs`);
    await expect(screen(page, 'CL-04')).toBeVisible();
    await expect(page.locator('[data-status="unconfirmed"]')).toHaveCount(0);
    await expect(page.locator('[data-status="private"]')).toHaveCount(0);
    await page.locator(key('design-list-item')).filter({ hasText: '거실 도안' }).first().click();
    await expect(screen(page, 'CL-14')).toBeVisible();
    await expect(page.locator(key('design-version-download'))).toHaveCount(0);
    await expect(page.locator(key('design-edit-open'))).toHaveCount(0);
    await expect(page.locator('[data-status="unconfirmed"]')).toHaveCount(0);
    // 확정권 없는 고객에게는 확정 버튼이 없다
    await expect(page.locator(key('design-confirm-open'))).toHaveCount(0);
    // 원본 다운로드는 비교 가능 여부와 무관하게 가능 (B-T02)
    await expect(page.locator(key('design-original-download'))).toBeVisible();
  });
});

test.describe('자재 확정 흐름 (REQ-120·121, DB-01)', () => {
  test('cust1 확정 → PM 단가 수정 → 재확인 필요 → cust1 다시 확정', async ({ browser }) => {
    const cust = await loginAs(browser, 'cust1');
    const pm = await loginAs(browser, 'pm1');
    const id = SEED.materialPublic;

    // 1) 처음 상태가 무엇이든 확정으로 맞춘다 (반복 실행 대비)
    await cust.goto(portal.material(id));
    await expect(screen(cust, 'CL-15')).toBeVisible();
    await confirmIfNeeded(cust);
    await expect(cust.locator(key('material-confirmed-line'))).toBeVisible();

    // PM 화면: 확정 배지(positive)
    await pm.goto(app.material(id));
    await expect(pm.locator('[data-status="confirmed"]')).toBeVisible();
    const original = await currentUnitPrice(pm);

    // 2) PM 이 단가(핵심 필드)를 바꾼다 → 재확인 필요(attention)
    const changed = original + 1 + (Date.now() % 97);
    await editUnitPrice(pm, changed);
    await expect(pm.locator('[data-status="needs_reconfirm"]')).toHaveAttribute(
      'data-tone',
      'attention',
    );

    // 3) 고객: 재확인 필요 배지 + [변경됨 — 다시 확정] → 다시 확정
    await cust.reload();
    await expect(cust.locator('[data-status="needs_reconfirm"]').first()).toBeVisible();
    await confirmIfNeeded(cust);
    await expect(cust.locator(key('material-confirmed-line'))).toBeVisible();
    await expect(cust.locator(key('material-confirm-open'))).toHaveCount(0);

    // 되돌리기: 단가 원복 → 다시 확정 (최종 상태 = 원래 단가 + 확정)
    await pm.reload();
    await editUnitPrice(pm, original);
    await expect(pm.locator('[data-status="needs_reconfirm"]')).toBeVisible();
    await cust.reload();
    await confirmIfNeeded(cust);
    await expect(cust.locator(key('material-confirmed-line'))).toBeVisible();

    await cust.context().close();
    await pm.context().close();
  });

  test('확정권 없는 고객(cust2)에게는 확정 버튼이 없다 · 미초대 고객(cust3)은 404', async ({
    browser,
  }) => {
    const cust2 = await loginAs(browser, 'cust2');
    await cust2.goto(portal.material(SEED.materialPublic));
    await expect(screen(cust2, 'CL-15')).toBeVisible();
    await expect(cust2.locator(key('material-confirm-open'))).toHaveCount(0);
    // 비공개 자재 직접 링크 → 404
    const res = await cust2.goto(portal.material(SEED.materialPrivate));
    expect(res?.status()).toBe(404);
    await cust2.context().close();

    const cust3 = await loginAs(browser, 'cust3');
    const r3 = await cust3.goto(portal.material(SEED.materialPublic));
    expect(r3?.status()).toBe(404);
    await cust3.context().close();
  });
});

// ---------------------------------------------------------------------------

async function editLocationNote(page: Page, value: string) {
  await page.locator(key('material-edit-open')).click();
  const sheet = page.locator(key('material-edit-sheet'));
  await expect(sheet).toBeVisible();
  await sheet.locator(key('material-form-location-note')).fill(value);
  await page.locator(key('material-edit-submit')).click();
  await expect(sheet).toBeHidden();
}

async function editUnitPrice(page: Page, value: number) {
  await page.locator(key('material-edit-open')).click();
  const sheet = page.locator(key('material-edit-sheet'));
  await expect(sheet).toBeVisible();
  await sheet.locator(key('material-form-unit-price')).fill(String(value));
  await page.locator(key('material-edit-submit')).click();
  await expect(sheet).toBeHidden();
  await expect(page.locator(key('material-detail-unit-price'))).toContainText(
    value.toLocaleString('ko-KR'),
  );
}

async function currentUnitPrice(page: Page): Promise<number> {
  await page.locator(key('material-edit-open')).click();
  const sheet = page.locator(key('material-edit-sheet'));
  const raw = await sheet.locator(key('material-form-unit-price')).inputValue();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  return Number(raw.replaceAll(',', '')) || 0;
}

/** 확정 버튼이 있으면(none · needs_reconfirm) AlertDialog 로 확정한다 */
async function confirmIfNeeded(page: Page) {
  const open = page.locator(key('material-confirm-open'));
  if ((await open.count()) === 0) return;
  await open.click();
  const dialog = page.locator(key('material-confirm-dialog'));
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('role', 'alertdialog');
  await page.locator(key('material-confirm-dialog-confirm')).click();
  await expect(open).toHaveCount(0);
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
}

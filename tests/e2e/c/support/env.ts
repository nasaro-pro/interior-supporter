// tests/e2e/c 공용 — 통합 dev 시드(supabase/seed.sql + tools/seed-extra.mjs, 90_reports/seed_map.md) 기준
// 비밀번호는 E2E_SEED_PASSWORD 환경변수로만 받는다 (통합 Playwright 설정이 .env.local 에서 넘긴다). 값을 출력·기록하지 않는다
import type { Browser, Page } from '@playwright/test';

const PASSWORD = process.env.E2E_SEED_PASSWORD ?? '';
export const hasSeed = PASSWORD !== '';

/** 시드 보강 데이터 id (접두 00000000-0000-4000-9000-) */
const row = (n: string) => `00000000-0000-4000-9000-${n}`;

export const seed = {
  slug: 'studio-x',
  p1: '00000000-0000-4000-b000-000000000001',
  p2: '00000000-0000-4000-b000-000000000002',
  q1: '00000000-0000-4000-b000-000000000003',
  /** 프로젝트 이름 (시드 고정값 — 현장명 표시·전체 캘린더 칩 확인용) */
  p1Name: '반포 래미안 32평 리모델링',
  p2Name: '분당 오피스텔 부분 시공',
  /** cust1 의 요청 (cust2 에게는 404) */
  requestU1: row('000000000701'),
  /** cust2 의 요청 */
  requestU2: row('000000000703'),
  photoPublic: row('000000000501'),
  /** field1 이 올린 비공개 사진 */
  photoField1Private: row('000000000502'),
  eventPublic: row('000000000601'),
  eventPrivate: row('000000000603'),
};

/** 헌법 부록 C 기호 → 통합 시드 계정 (@example.test) */
const ACCOUNTS = {
  OX: 'owner-x',
  PM1: 'pm1',
  PM2: 'pm2',
  U1: 'cust1',
  U2: 'cust2',
  U3: 'cust3',
  F1: 'field1', // P1 시공팀 (유효)
  F2: 'field2', // P1 시공팀, 기간 만료
  F3: 'field3', // P1·P2 시공팀 (여러 현장)
  F4: 'field4', // P1 시공팀, 배정 회수
  OY: 'owner-y',
} as const;

export type Who = keyof typeof ACCOUNTS;

export const emailOf = (who: Who) => `${ACCOUNTS[who]}@example.test`;

/** 로그인 화면(AUTH-01, A auth-forms)으로 로그인한 새 컨텍스트의 페이지 */
export async function loginAs(browser: Browser, who: Who): Promise<Page> {
  const context = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage();
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(emailOf(who));
  await page.locator('input[name="password"]').fill(PASSWORD);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login')),
    page.locator('[data-ui-key="login-form-submit"]').click(),
  ]);
  return page;
}

/** 1×1 PNG (업로드 테스트용) */
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** 데이터를 만드는 테스트는 고유 문구를 쓴다 (빈 목록을 가정하지 않는다) */
export const unique = (prefix: string) =>
  `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** 오늘(KST)의 YYYY-MM — 앱 달력은 KST 기준이라 UTC 로 자르면 매월 1일 00~09시에 한 달 어긋난다 (C-10) */
export const kstMonth = (now: Date = new Date()) =>
  new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);

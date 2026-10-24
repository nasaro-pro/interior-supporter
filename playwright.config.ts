// playwright.config.ts (A · 스타터 고정) — E2E. 담당별 폴더 tests/e2e/<a|b|c>/ 에 둔다. dev Supabase 필요.
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.APP_ORIGIN ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure', locale: 'ko-KR', timezoneId: 'Asia/Seoul' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: { command: 'npm run dev', url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});

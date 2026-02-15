import { chromium, BrowserContext, Page } from '@playwright/test';

async function loginAndCapture(
  context: BrowserContext,
  colorMode: 'dark' | 'light',
  outPath: string
): Promise<void> {
  const page = await context.newPage();

  // Set color mode in localStorage before loading the app
  await page.goto('http://localhost:5173/login');
  await page.evaluate((mode) => {
    localStorage.setItem('color_mode', mode);
    localStorage.setItem('design_mode', 'modern');
  }, colorMode);

  // Reload to pick up the localStorage setting
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');

  await page.fill('input[name="email"], input[type="email"]', 'demo@testops.ai');
  await page.fill('input[name="password"], input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  await page.screenshot({ path: outPath, fullPage: true });
  console.log(`${colorMode} screenshot saved: ${outPath}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const outDir = '/home/user/testops-companion/docs/assets/screenshots';

  const darkCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await loginAndCapture(darkCtx, 'dark', `${outDir}/dashboard-modern-dark.png`);

  const lightCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await loginAndCapture(lightCtx, 'light', `${outDir}/dashboard-modern-light.png`);

  await browser.close();
  console.log('Done!');
})();

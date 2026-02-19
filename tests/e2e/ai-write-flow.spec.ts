
import { test, expect } from '@playwright/test';

test('AI Write Tool Confirmation Flow', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'demo@testops.ai');
    await page.fill('input[name="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');

    // 2. Open Copilot (Click the Sparkle FAB)
    // The FAB is an IconButton with the SparkleIcon (AutoAwesome)
    const fab = page.locator('button').filter({ has: page.locator('svg[data-testid="AutoAwesomeIcon"]') });
    await expect(fab).toBeVisible();
    await fab.click();

    // 3. Trigger write action
    const input = page.getByPlaceholder('Ask Copilot...');
    await expect(input).toBeVisible();
    await input.fill('Create a Jira bug: "E2E Test Failure"');
    await input.press('Enter');

    // 4. Wait for confirmation card
    // New MUI implementation says "APPROVAL REQUIRED" in a Typography
    const confirmationCard = page.locator('.MuiPaper-root').filter({ hasText: 'APPROVAL REQUIRED' }).first();
    await expect(confirmationCard).toBeVisible({ timeout: 10000 });

    // Verify tool args are visible (Payload Preview)
    await expect(confirmationCard).toContainText('E2E Test Failure');

    // 5. Deny Action first
    await confirmationCard.getByRole('button', { name: 'Deny' }).click();

    // 6. Verify status update
    // The previous locator relied on 'APPROVAL REQUIRED', which is replaced by 'ACTION DENIED'
    const deniedCard = page.locator('.MuiPaper-root').filter({ hasText: 'ACTION DENIED' }).first();
    await expect(deniedCard).toBeVisible();
});


import { test, expect } from '@playwright/test';

test('AI Write Tool Confirmation Flow', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');

    // 2. Open Copilot
    // Assuming Copilot is always visible or there's a toggle. 
    // Based on AICopilot.tsx, it's an <aside>
    const input = page.locator('.copilot-sidebar input');
    await expect(input).toBeVisible();

    // 3. Trigger write action
    await input.fill('Create a Jira bug: "E2E Test Failure"');
    await input.press('Enter');

    // 4. Wait for confirmation card
    // The card has "Approval Required" text
    const confirmationCard = page.locator('.smart-card.type-action', { hasText: 'Approval Required' });
    await expect(confirmationCard).toBeVisible({ timeout: 10000 });

    // Verify tool args are visible
    await expect(confirmationCard).toContainText('E2E Test Failure');

    // 5. Deny Action first
    // We don't want to actually spam Jira in E2E tests usually, unless we mock the backend.
    // For this test, verifying the UI appears and reacting to buttons is the goal.
    // Ideally we mock the /api/ai/chat response, but here we are testing the full integration.
    // Let's Deny to be safe.
    await confirmationCard.locator('button', { hasText: 'Deny' }).click();

    // 6. Verify status update
    await expect(confirmationCard).toContainText('❌ Denied');
});

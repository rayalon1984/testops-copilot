import { test, expect } from '@playwright/test';
import {
    setupAuthenticatedSession,
    mockChatSSE,
    mockConfirmAction,
    SCENARIO_JIRA_CREATE,
} from './fixtures/mock-api';

test('AI Write Tool Confirmation Flow', async ({ page }) => {
    await setupAuthenticatedSession(page);
    await mockChatSSE(page, SCENARIO_JIRA_CREATE);
    await mockConfirmAction(page, false);

    await page.goto('/dashboard');
    await expect(page.getByText('TestOps Copilot').first()).toBeVisible();

    // Trigger write action via copilot chat
    const input = page.locator('textarea[placeholder="Ask Copilot..."]');
    await expect(input).toBeVisible();
    await input.fill('Create a Jira bug: "E2E Test Failure"');
    await input.press('Enter');

    // Wait for confirmation card
    const confirmationCard = page.locator('.MuiPaper-root').filter({ hasText: 'APPROVAL REQUIRED' }).first();
    await expect(confirmationCard).toBeVisible({ timeout: 10000 });

    // Verify tool args are visible
    await expect(confirmationCard).toContainText('Login Timeout Fix');

    // Deny Action
    await confirmationCard.getByRole('button', { name: /deny/i }).click();

    // Verify status update
    const deniedCard = page.locator('.MuiPaper-root').filter({ hasText: 'ACTION DENIED' }).first();
    await expect(deniedCard).toBeVisible({ timeout: 5000 });
});

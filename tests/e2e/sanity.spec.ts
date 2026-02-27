import { test, expect } from '@playwright/test';
import { setupAuthenticatedSession } from './fixtures/mock-api';

test('has title', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/TestOps Copilot/);
});

test('loads dashboard and shows metrics', async ({ page }) => {
    await setupAuthenticatedSession(page);
    await page.goto('/dashboard');

    // Wait for main layout
    await expect(page.locator('#root')).toBeVisible();

    // Wait for some content to load — "Dashboard" appears in sidebar, heading, and breadcrumb
    await expect(page.getByText('Dashboard').first()).toBeVisible();
});

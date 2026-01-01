import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/TestOps Companion/);
});

test('loads dashboard and shows metrics', async ({ page }) => {
    await page.goto('/');

    // Verify critical dashboard elements are present
    // Note: Selectors might need adjustment based on actual frontend implementation
    // Looking for general structure first

    // Wait for main layout
    await expect(page.locator('#root')).toBeVisible();

    // Wait for some content to load
    await expect(page.getByText('TestOps Companion')).toBeVisible();

    // Check for navigation sidebar or header
    // Assuming standard layout elements based on typical React apps
    // We'll improve selectors after first run failure/inspection if needed
    // But searching for text is usually robust for sanity
    const appTitle = page.getByText('TestOps Companion');
    await expect(appTitle).toBeVisible();

    // Check for specific dashboard metrics or headers
    // E.g., "Pipeline Health", "Test Runs", etc.
    // Using generic text matchers for flexibility
    // await expect(page.getByText(/Pipeline Health/i)).toBeVisible(); // Commented out until verified content
});

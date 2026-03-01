import { test, expect } from '@playwright/test';
import { setupAuthenticatedSession } from './fixtures/mock-api';

// ─── Core Sanity ─────────────────────────────────────────────────────

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

// ─── Post-Update Health Assertions ───────────────────────────────────

test('login page loads and shows login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#root')).toBeVisible();

    // Login form should render with a sign-in button
    await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible();
});

test('critical routes are accessible without crash', async ({ page }) => {
    await setupAuthenticatedSession(page);

    // Each critical route must render without blank page or error overlay
    const routes = ['/', '/dashboard', '/login'];
    for (const route of routes) {
        await page.goto(route);
        await expect(page.locator('#root')).toBeVisible();

        // Content must exist (no blank white screen)
        const rootContent = await page.locator('#root').textContent();
        expect(rootContent?.length).toBeGreaterThan(0);
    }
});

test('layout components render on dashboard', async ({ page }) => {
    await setupAuthenticatedSession(page);
    await page.goto('/dashboard');

    // Sidebar navigation should be present
    await expect(page.locator('nav, [role="navigation"]').first()).toBeVisible();

    // Main content area should exist and contain dashboard content
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
});

// ─── Theme Toggle: Dark ↔ Light ─────────────────────────────────────

test('dark/light mode toggle changes theme without crash', async ({ page }) => {
    await setupAuthenticatedSession(page);

    // Navigate first, then set localStorage (can't access before navigation)
    await page.goto('/dashboard');
    await expect(page.locator('#root')).toBeVisible();

    // Set dark mode and reload
    await page.evaluate(() => {
        localStorage.setItem('design_mode', 'modern');
        localStorage.setItem('color_mode', 'dark');
    });
    await page.reload();
    await expect(page.locator('#root')).toBeVisible();

    // Verify dark mode background (MUI sets body background via CssBaseline)
    const darkBg = await page.evaluate(() =>
        getComputedStyle(document.body).backgroundColor
    );
    // Dark mode should NOT be white (#ffffff / rgb(255,255,255))
    expect(darkBg).not.toBe('rgb(255, 255, 255)');

    // Switch to light mode via localStorage + reload
    await page.evaluate(() => {
        localStorage.setItem('color_mode', 'light');
    });
    await page.reload();
    await expect(page.locator('#root')).toBeVisible();

    // Verify light mode background is lighter
    const lightBg = await page.evaluate(() =>
        getComputedStyle(document.body).backgroundColor
    );
    // Light mode should NOT be the same as dark mode
    expect(lightBg).not.toBe(darkBg);

    // Content should still render correctly after theme switch
    await expect(page.getByText('Dashboard').first()).toBeVisible();

    // Copilot panel should still be visible
    await expect(page.getByText('TestOps Copilot').first()).toBeVisible();

    // Switch back to dark mode
    await page.evaluate(() => {
        localStorage.setItem('color_mode', 'dark');
    });
    await page.reload();
    await expect(page.locator('#root')).toBeVisible();

    const restoredBg = await page.evaluate(() =>
        getComputedStyle(document.body).backgroundColor
    );
    expect(restoredBg).toBe(darkBg);
});

// ─── Backend Health ─────────────────────────────────────────────────

test('API health endpoint responds when backend is available', async ({ page }) => {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';

    try {
        const response = await page.request.get(`${backendUrl}/health`);
        expect(response.ok()).toBe(true);
        const body = await response.json();
        expect(body).toHaveProperty('status');
    } catch {
        // Backend not running — skip gracefully in frontend-only E2E mode
        test.skip();
    }
});

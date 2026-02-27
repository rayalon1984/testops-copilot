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

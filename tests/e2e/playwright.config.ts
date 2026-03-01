import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './',
    testMatch: '**/*.spec.ts',
    testIgnore: ['**/node_modules/**', '**/backend/**', '**/fixtures/**'],
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    timeout: 30000,
    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    /* Auto-start the frontend dev server */
    webServer: {
        command: 'npm run dev:frontend',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 60000,
        cwd: '../../',
    },
});

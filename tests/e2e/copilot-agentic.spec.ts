/**
 * E2E Tests — Full Agentic AI Copilot Flow
 *
 * Playwright smoke tests covering the complete copilot user journey:
 * 1. Login → Dashboard → Copilot panel visible
 * 2. Send query → persona routing → thinking → tool exec → result card → answer
 * 3. Write tool → confirmation card → approve / deny
 * 4. Proactive suggestion → accept / dismiss
 * 5. Autonomous (Tier 1) actions → notification cards
 * 6. Persona badge rendering
 * 7. Page context awareness across navigation
 *
 * All backend APIs are mocked via Playwright route interceptors.
 */

import { test, expect } from '@playwright/test';
import {
  setupAuthenticatedSession,
  mockChatSSE,
  mockConfirmAction,
  SCENARIO_JIRA_SEARCH,
  SCENARIO_JIRA_CREATE,
  SCENARIO_PROACTIVE_SUGGESTION,
  SCENARIO_AUTONOMOUS_ACTION,
  SCENARIO_SECURITY_PERSONA,
} from './fixtures/mock-api';

// ─── Setup ───────────────────────────────────────────────────────────

test.describe('Agentic AI Copilot E2E', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page);
  });

  // ─── 1. Login & Dashboard ──────────────────────────────────────────

  test('login and see dashboard with copilot panel', async ({ page }) => {
    await page.goto('/login');

    // Fill login form
    await page.getByLabel('Email Address').fill('engineer@testops.ai');
    await page.getByLabel('Password').fill('demo123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should navigate to dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Copilot panel should be visible (embedded in 3-column layout)
    // Use .first() because "TestOps Copilot" appears in both the header and the empty state
    await expect(page.getByText('TestOps Copilot').first()).toBeVisible();

    // Empty state should show starter prompts (placeholder text on textarea)
    await expect(page.getByPlaceholder('Ask Copilot...')).toBeVisible();
  });

  // ─── 2. Read-Only Query → Full ReAct Flow ─────────────────────────

  test('send query and see full ReAct flow: thinking → tool → result → answer', async ({ page }) => {
    await mockChatSSE(page, SCENARIO_JIRA_SEARCH);
    await page.goto('/dashboard');
    await expect(page.getByText('TestOps Copilot').first()).toBeVisible();

    // Type a message in the copilot chat
    const chatInput = page.locator('textarea[placeholder="Ask Copilot..."]');
    await expect(chatInput).toBeVisible();
    await chatInput.fill('Find recent Jira failures');
    await chatInput.press('Enter');

    // User message should appear
    await expect(page.getByText('Find recent Jira failures')).toBeVisible();

    // Tool execution indicator should appear
    await expect(page.getByText(/jira_search/i)).toBeVisible({ timeout: 5000 });

    // Tool result card should render issue details from JiraSearchCard
    await expect(page.getByText('Login timeout on EU region')).toBeVisible({ timeout: 5000 });

    // Final assistant answer
    await expect(page.getByText(/PROJ-1248/).first()).toBeVisible({ timeout: 5000 });
  });

  // ─── 3. Write Tool → Confirmation Card ────────────────────────────

  test('write tool triggers confirmation card with approve/deny', async ({ page }) => {
    await mockChatSSE(page, SCENARIO_JIRA_CREATE);
    await page.goto('/dashboard');
    await expect(page.getByText('TestOps Copilot').first()).toBeVisible({ timeout: 10000 });

    // Send a write-triggering message
    const chatInput = page.locator('textarea[placeholder="Ask Copilot..."]');
    await expect(chatInput).toBeVisible();
    await chatInput.fill('Create a Jira bug for the login timeout');
    await chatInput.press('Enter');

    // Confirmation card should appear with "REVIEW"
    const confirmCard = page.locator('.MuiPaper-root').filter({ hasText: 'REVIEW' }).first();
    await expect(confirmCard).toBeVisible({ timeout: 10000 });

    // Should show the action label and args preview
    await expect(confirmCard).toContainText('Create Issue');
    await expect(confirmCard).toContainText('Login Timeout Fix');
  });

  test('deny confirmation changes card to DENIED', async ({ page }) => {
    await mockChatSSE(page, SCENARIO_JIRA_CREATE);
    await mockConfirmAction(page, false);
    await page.goto('/dashboard');
    await expect(page.getByText('TestOps Copilot').first()).toBeVisible();

    const chatInput = page.locator('textarea[placeholder="Ask Copilot..."]');
    await expect(chatInput).toBeVisible();
    await chatInput.fill('Create a Jira bug for the login timeout');
    await chatInput.press('Enter');

    // Wait for confirmation card
    const confirmCard = page.locator('.MuiPaper-root').filter({ hasText: 'REVIEW' }).first();
    await expect(confirmCard).toBeVisible({ timeout: 10000 });

    // Click Deny
    await confirmCard.getByRole('button', { name: /deny/i }).click();

    // Card should update to show denied status
    const deniedCard = page.locator('.MuiPaper-root').filter({ hasText: 'DENIED' }).first();
    await expect(deniedCard).toBeVisible({ timeout: 5000 });
  });

  test('approve confirmation executes the tool', async ({ page }) => {
    await mockChatSSE(page, SCENARIO_JIRA_CREATE);
    await mockConfirmAction(page, true);
    await page.goto('/dashboard');
    await expect(page.getByText('TestOps Copilot').first()).toBeVisible();

    const chatInput = page.locator('textarea[placeholder="Ask Copilot..."]');
    await expect(chatInput).toBeVisible();
    await chatInput.fill('Create a Jira bug for the login timeout');
    await chatInput.press('Enter');

    // Wait for confirmation card
    const confirmCard = page.locator('.MuiPaper-root').filter({ hasText: 'REVIEW' }).first();
    await expect(confirmCard).toBeVisible({ timeout: 10000 });

    // Click Approve — ConfirmationShell uses tool-specific labels (e.g. "Create Issue")
    await confirmCard.getByRole('button', { name: /create issue/i }).click();

    // Card should update to approved and tool result should appear
    await expect(page.getByText(/PROJ-1299/)).toBeVisible({ timeout: 10000 });
  });

  // ─── 4. Proactive Suggestions ──────────────────────────────────────

  test('proactive suggestion card appears after empty search', async ({ page }) => {
    await mockChatSSE(page, SCENARIO_PROACTIVE_SUGGESTION);
    await page.goto('/dashboard');
    await expect(page.getByText('TestOps Copilot').first()).toBeVisible();

    const chatInput = page.locator('textarea[placeholder="Ask Copilot..."]');
    await expect(chatInput).toBeVisible();
    await chatInput.fill('Check if there is a Jira for the checkout failure');
    await chatInput.press('Enter');

    // Should see the empty result (JiraSearchCard renders this for empty arrays)
    await expect(page.getByText('No issues found.')).toBeVisible({ timeout: 5000 });

    // Proactive suggestion card should appear
    await expect(page.getByText(/Would you like me to create one/i)).toBeVisible({ timeout: 5000 });

    // Test Engineer persona should be shown
    await expect(page.getByText('Test Engineer').first()).toBeVisible();
  });

  // ─── 5. Autonomous (Tier 1) Actions ────────────────────────────────

  test('Tier 1 autonomous actions show notification cards', async ({ page }) => {
    await mockChatSSE(page, SCENARIO_AUTONOMOUS_ACTION);
    await page.goto('/dashboard');
    await expect(page.getByText('TestOps Copilot').first()).toBeVisible();

    const chatInput = page.locator('textarea[placeholder="Ask Copilot..."]');
    await expect(chatInput).toBeVisible();
    await chatInput.fill('Analyze the root cause of PROJ-1248');
    await chatInput.press('Enter');

    // RCA tool result
    await expect(page.getByText(/EU API latency spike/i).first()).toBeVisible({ timeout: 5000 });

    // Autonomous action notifications — cards render "Jira Housekeeping" with "Auto" badge
    await expect(page.getByText('Jira Housekeeping').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/investigated-by-ai/i)).toBeVisible({ timeout: 5000 });

    // Final answer summarizing everything
    await expect(page.getByText(/automatically linked/i)).toBeVisible({ timeout: 5000 });
  });

  // ─── 6. Persona Routing & Badge ────────────────────────────────────

  test('security query routes to Security Engineer persona', async ({ page }) => {
    await mockChatSSE(page, SCENARIO_SECURITY_PERSONA);
    await page.goto('/dashboard');
    await expect(page.getByText('TestOps Copilot').first()).toBeVisible();

    const chatInput = page.locator('textarea[placeholder="Ask Copilot..."]');
    await expect(chatInput).toBeVisible();
    await chatInput.fill('Are there any auth vulnerabilities?');
    await chatInput.press('Enter');

    // Persona badge should show Security Engineer
    await expect(page.getByText('Security Engineer').first()).toBeVisible({ timeout: 5000 });

    // Answer should reference SAML
    await expect(page.getByText(/SAML/i)).toBeVisible({ timeout: 5000 });
  });

  // ─── 7. Chat Clear ─────────────────────────────────────────────────

  test('clear chat removes all messages', async ({ page }) => {
    await mockChatSSE(page, SCENARIO_JIRA_SEARCH);
    await page.goto('/dashboard');
    await expect(page.getByText('TestOps Copilot').first()).toBeVisible();

    // Send a message to populate chat
    const chatInput = page.locator('textarea[placeholder="Ask Copilot..."]');
    await expect(chatInput).toBeVisible();
    await chatInput.fill('Find failures');
    await chatInput.press('Enter');

    // Wait for response — JiraSearchCard renders issue summaries
    await expect(page.getByText('Login timeout on EU region')).toBeVisible({ timeout: 5000 });

    // Click clear button (trash icon in header)
    const clearBtn = page.locator('button[title="Clear chat"]');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // Messages should be gone, empty state should return
    await expect(page.getByText('Login timeout on EU region')).not.toBeVisible();
  });

  // ─── 8. Page Navigation Updates AI Context ─────────────────────────

  test('navigating between pages works with copilot visible', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('TestOps Copilot').first()).toBeVisible();

    // Navigate to pipelines
    await page.getByRole('button', { name: /pipelines/i }).first().click();
    await expect(page).toHaveURL(/\/pipelines/);
    // Copilot should still be visible
    await expect(page.getByText('TestOps Copilot').first()).toBeVisible();

    // Navigate to test runs
    await page.getByRole('button', { name: /test runs/i }).first().click();
    await expect(page).toHaveURL(/\/test-runs/);
    await expect(page.getByText('TestOps Copilot').first()).toBeVisible();
  });

  // ─── 9. Chat Input Behavior ────────────────────────────────────────

  test('Enter sends message, Shift+Enter adds newline', async ({ page }) => {
    await mockChatSSE(page, SCENARIO_JIRA_SEARCH);
    await page.goto('/dashboard');
    await expect(page.getByText('TestOps Copilot').first()).toBeVisible();

    const chatInput = page.locator('textarea[placeholder="Ask Copilot..."]');
    await expect(chatInput).toBeVisible();

    // Shift+Enter should add newline without sending
    await chatInput.fill('Line 1');
    await chatInput.press('Shift+Enter');
    await chatInput.type('Line 2');

    // Textarea should contain both lines (not submitted yet)
    await expect(chatInput).toHaveValue(/Line 1\nLine 2/);

    // Enter should send
    await chatInput.press('Enter');

    // Message should appear in chat
    await expect(page.getByText('Line 1')).toBeVisible({ timeout: 5000 });
  });

  // ─── 10. Multiple Queries in Same Session ──────────────────────────

  test('multiple queries accumulate in chat history', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('TestOps Copilot').first()).toBeVisible();

    // First query
    await mockChatSSE(page, SCENARIO_JIRA_SEARCH);
    const chatInput = page.locator('textarea[placeholder="Ask Copilot..."]');
    await expect(chatInput).toBeVisible();
    await chatInput.fill('Find Jira issues');
    await chatInput.press('Enter');
    await expect(page.getByText('Login timeout on EU region')).toBeVisible({ timeout: 5000 });

    // Unroute and set up second query
    await page.unroute('**/api/v1/ai/chat');
    await mockChatSSE(page, SCENARIO_SECURITY_PERSONA);

    await chatInput.fill('Check auth security');
    await chatInput.press('Enter');
    await expect(page.getByText(/SAML/i)).toBeVisible({ timeout: 5000 });

    // Both conversations should be visible
    await expect(page.getByText('Find Jira issues')).toBeVisible();
    await expect(page.getByText('Check auth security')).toBeVisible();
  });
});

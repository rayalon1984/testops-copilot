/**
 * MockProvider — Intent Matching Unit Tests
 *
 * Validates that the 4 quick-action prompts from EmptyState.tsx route to the
 * correct tools, both with and without the [UI Context: ...] prefix that
 * AIChatService injects.
 */

import { MockProvider } from '../mock.provider';
import type { ChatMessage } from '../../types';

jest.mock('@/utils/logger', () => ({
    __esModule: true,
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const provider = new MockProvider({ apiKey: 'test', model: 'mock' });

/** Build a messages array with a single user message, optionally prefixed with UI context. */
function userMsg(text: string, uiContext?: string): ChatMessage[] {
    const content = uiContext
        ? `[UI Context: ${uiContext}]\n\n${text}`
        : text;
    return [{ role: 'user', content }];
}

describe('MockProvider — intent matching', () => {

    // ── Quick-action prompts WITH UI context (the bug scenario) ──

    describe('quick-action prompts WITH Dashboard UI context', () => {
        const UI_CTX = 'User is viewing: Dashboard overview';

        it('routes "Analyze the most recent test failure..." to jira_search', async () => {
            const res = await provider.chat(userMsg(
                'Analyze the most recent test failure and suggest a fix', UI_CTX));
            expect(res.toolCalls).toBeDefined();
            expect(res.toolCalls![0].name).toBe('jira_search');
        });

        it('routes "Show me failure trends..." to failure_predictions', async () => {
            const res = await provider.chat(userMsg(
                'Show me failure trends for the past 30 days', UI_CTX));
            expect(res.toolCalls).toBeDefined();
            expect(res.toolCalls![0].name).toBe('failure_predictions');
        });

        it('routes "What is the current status of all pipelines?" to jenkins_get_status', async () => {
            const res = await provider.chat(userMsg(
                'What is the current status of all pipelines?', UI_CTX));
            expect(res.toolCalls).toBeDefined();
            expect(res.toolCalls![0].name).toBe('jenkins_get_status');
        });

        it('routes "Search Jira for open issues..." to jira_search', async () => {
            const res = await provider.chat(userMsg(
                'Search Jira for open issues related to recent failures', UI_CTX));
            expect(res.toolCalls).toBeDefined();
            expect(res.toolCalls![0].name).toBe('jira_search');
        });
    });

    // ── Same prompts WITHOUT UI context ──

    describe('quick-action prompts WITHOUT UI context', () => {
        it('routes "Analyze the most recent test failure..." to jira_search', async () => {
            const res = await provider.chat(userMsg(
                'Analyze the most recent test failure and suggest a fix'));
            expect(res.toolCalls).toBeDefined();
            expect(res.toolCalls![0].name).toBe('jira_search');
        });

        it('routes "Show me failure trends..." to failure_predictions', async () => {
            const res = await provider.chat(userMsg(
                'Show me failure trends for the past 30 days'));
            expect(res.toolCalls).toBeDefined();
            expect(res.toolCalls![0].name).toBe('failure_predictions');
        });

        it('routes "What is the current status of all pipelines?" to jenkins_get_status', async () => {
            const res = await provider.chat(userMsg(
                'What is the current status of all pipelines?'));
            expect(res.toolCalls).toBeDefined();
            expect(res.toolCalls![0].name).toBe('jenkins_get_status');
        });

        it('routes "Search Jira for open issues..." to jira_search', async () => {
            const res = await provider.chat(userMsg(
                'Search Jira for open issues related to recent failures'));
            expect(res.toolCalls).toBeDefined();
            expect(res.toolCalls![0].name).toBe('jira_search');
        });
    });

    // ── Non-tool responses ──

    describe('greetings, help, and fallback', () => {
        it('returns greeting text for "hello"', async () => {
            const res = await provider.chat(userMsg('hello'));
            expect(res.toolCalls).toBeUndefined();
            expect(res.content).toContain('TestOps AI Copilot');
        });

        it('returns help text for "what can you do"', async () => {
            const res = await provider.chat(userMsg('what can you do'));
            expect(res.toolCalls).toBeUndefined();
            expect(res.content).toContain('agentic AI');
        });

        it('returns fallback for unrecognized input', async () => {
            const res = await provider.chat(userMsg('lorem ipsum dolor sit amet'));
            expect(res.toolCalls).toBeUndefined();
            expect(res.content).toContain('Demo Mode');
        });

        it('greeting still works with UI context prefix', async () => {
            const res = await provider.chat(userMsg('hello', 'User is viewing: Dashboard overview'));
            expect(res.toolCalls).toBeUndefined();
            expect(res.content).toContain('TestOps AI Copilot');
        });
    });

    // ── Tool result wrap-up ──

    describe('tool result wrap-up', () => {
        it('returns contextual summary after tool result message', async () => {
            const messages: ChatMessage[] = [
                { role: 'user', content: 'Check pipeline status' },
                { role: 'tool', content: '{"status":"ok"}', name: 'jenkins_get_status' },
            ];
            const res = await provider.chat(messages);
            expect(res.toolCalls).toBeUndefined();
            expect(res.content).toContain('checkout-e2e');
        });
    });
});

import { BaseProvider, ProviderConfig, ProviderLimits, ProviderPricing, CompletionOptions, EmbeddingOptions } from './base.provider';
import { AIProviderName, AIResponse, ChatMessage } from '../types';

export class MockProvider extends BaseProvider {
    constructor(config: ProviderConfig) {
        super(config);
    }

    getName(): AIProviderName {
        return 'mock';
    }

    getPricing(): ProviderPricing {
        return {
            inputTokenCostPer1k: 0,
            outputTokenCostPer1k: 0,
            embeddingCostPer1k: 0,
        };
    }

    getLimits(): ProviderLimits {
        return {
            maxInputTokens: 100000,
            maxOutputTokens: 100000,
            requestsPerMinute: 1000,
            tokensPerMinute: 1000000,
        };
    }

    async chat(messages: ChatMessage[], options?: CompletionOptions): Promise<AIResponse> {
        const lastMessage = messages[messages.length - 1];

        // Prevent Infinite Loop: If the last message was a tool result, assume success and finish.
        if (lastMessage.role === 'tool') {
            return {
                content: "✅ Action completed successfully! Is there anything else I can help you with?",
                provider: 'mock',
                model: 'mock-smart-v1',
                cost: { inputCost: 0, outputCost: 0, totalCost: 0 },
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                cached: false,
                responseTimeMs: 200
            };
        }

        const userContent = lastMessage.content.toLowerCase();

        // -- AI_ARCHITECT: Smart Intent Matching for Demo --

        // Intent 1: Create Jira Ticket
        if (this.matchesIntent(userContent, ['jira', 'ticket', 'issue', 'bug'], ['create', 'open', 'file', 'make'])) {
            return this.simulateJiraToolCall();
        }

        // Intent 2: Explain Failure / RCA
        if (this.matchesIntent(userContent, ['explain', 'why', 'cause', 'reason', 'analyze', 'failure', 'failed'])) {
            return this.simulateRCA();
        }

        // Intent 3: Greeting
        if (this.matchesIntent(userContent, ['hi', 'hello', 'hey', 'greetings'])) {
            return {
                content: "Hello! I'm your TestOps AI Copilot. I can help you analyze failures, explain root causes, or create Jira tickets. Try asking: *\"Why did the checkout test fail?\"*",
                provider: 'mock',
                model: 'mock-smart-v1',
                cost: { inputCost: 0, outputCost: 0, totalCost: 0 },
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                cached: false,
                responseTimeMs: 150
            };
        }

        // Default: Fallback
        return {
            content: "I'm a demo agent running in 'Real Mode'. I can currently:\n1. **Analyze failures** (try: *\"Explain the failure\"*)\n2. **Create tickets** (try: *\"Create a Jira ticket\"*)\n\nI don't have a real LLM brain connected right now, so I only know these specific tricks! 🧠",
            provider: 'mock',
            model: 'mock-smart-v1',
            cost: { inputCost: 0, outputCost: 0, totalCost: 0 },
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            cached: false,
            responseTimeMs: 100
        };
    }

    private matchesIntent(text: string, primaryKeywords: string[], secondaryKeywords: string[] = []): boolean {
        const hasPrimary = primaryKeywords.some(k => text.includes(k));
        const hasSecondary = secondaryKeywords.length === 0 || secondaryKeywords.some(k => text.includes(k));
        return hasPrimary && hasSecondary;
    }

    private simulateJiraToolCall(): AIResponse {
        const toolCall = {
            tool: "jira_create_issue",
            args: {
                summary: "Fix flaky test PaymentProcessor.processCheckout",
                description: "The test 'PaymentProcessor.processCheckout' has a high failure rate (21%). Flip-flopping detected. Please investigate timeout settings in the styling service.",
                type: "Bug",
                priority: "High"
            }
        };

        return {
            content: `I'll create a Jira ticket for this. I've analyzed the logs and populated the details for you.\n\n\`\`\`tool_call\n${JSON.stringify(toolCall)}\n\`\`\``,
            provider: 'mock',
            model: 'mock-smart-v1',
            cost: { inputCost: 0, outputCost: 0, totalCost: 0 },
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            cached: false,
            responseTimeMs: 500
        };
    }

    private simulateRCA(): AIResponse {
        const rca = `
**Failure Analysis: PaymentProcessor.processCheckout**

**Root Cause:**
The test failed due to a \`TimeoutError\` waiting for the element \`#confirm-button\`.

**Context:**
- **Duration:** 5002ms (Exceeded 5000ms limit)
- **Logs:** \`Element not interactable\` warning at 4900ms.

**Recommendation:**
This looks like a race condition. The DOM is ready, but the button opacity is still transitioning.
**Fix:** Add \`await expect(page.locator('#confirm-button')).toBeVisible()\` before the click.
        `;

        return {
            content: rca.trim(),
            provider: 'mock',
            model: 'mock-smart-v1',
            cost: { inputCost: 0, outputCost: 0, totalCost: 0 },
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            cached: false,
            responseTimeMs: 800
        };
    }

    async embed(text: string, options?: EmbeddingOptions): Promise<number[]> {
        // Return a dummy 1536-dim vector
        return new Array(1536).fill(0).map(() => Math.random());
    }

    async healthCheck(): Promise<boolean> {
        return true;
    }
}

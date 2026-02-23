/**
 * Context Window Manager
 *
 * Orchestrates token budgeting across a single LLM request lifecycle.
 * Sits between the AIChatService and the providers, ensuring that the
 * messages array never exceeds the model's context window.
 *
 * Responsibilities:
 *  1. Size the token budget based on the active model's profile
 *  2. Trim conversation history (oldest first) when it exceeds budget
 *  3. Truncate tool results to their per-tool budget
 *  4. Log budget usage for observability
 */

import { ChatMessage } from './types';
import {
  TokenBudgetConfig,
  TokenBudgetTracker,
  estimateTokenCount,
  estimateMessageTokens,
  estimateConversationTokens,
  truncateToolResult,
  truncateToTokenBudget,
  pruneHistory,
  selectBudgetForContextWindow,
} from './token-budget';
import { ModelProfile, ModelTier, resolveModelProfile } from './model-tiers';
import { AIProviderName } from './types';
import { logger } from '@/utils/logger';

// ── Public Interface ────────────────────────────────────────────────────

export interface ContextWindowManagerOptions {
  /** Model ID (e.g. 'claude-opus-4-6', 'meta-llama/llama-3.2-3b-instruct') */
  modelId: string;
  /** Provider name */
  provider: AIProviderName;
  /** Override context window size (auto-detected from model profile otherwise) */
  contextWindowOverride?: number;
  /** Override the entire budget config */
  budgetOverride?: Partial<TokenBudgetConfig>;
}

export class ContextWindowManager {
  private profile: ModelProfile;
  private budgetConfig: TokenBudgetConfig;

  constructor(options: ContextWindowManagerOptions) {
    this.profile = resolveModelProfile(
      options.modelId,
      options.provider,
      options.contextWindowOverride
    );

    // Build budget from model profile, then apply overrides
    const baseBudget = selectBudgetForContextWindow(this.profile.contextWindow);
    this.budgetConfig = {
      ...baseBudget,
      ...options.budgetOverride,
    };

    logger.info(
      `[ContextWindowManager] Model: ${this.profile.modelId} (${this.profile.tier}), ` +
      `context: ${this.budgetConfig.contextWindowSize}, ` +
      `output reserve: ${this.budgetConfig.reservedForOutput}`
    );
  }

  /** Get the resolved model profile */
  getModelProfile(): ModelProfile {
    return this.profile;
  }

  /** Get the model's tier */
  getModelTier(): ModelTier {
    return this.profile.tier;
  }

  /** Get the active budget configuration */
  getBudgetConfig(): TokenBudgetConfig {
    return { ...this.budgetConfig };
  }

  /**
   * Prepare a messages array for an LLM call.
   *
   * This is the main entry point. It:
   *  1. Estimates total tokens
   *  2. Prunes history if over budget
   *  3. Returns the trimmed messages and a budget tracker for tool results
   */
  prepareMessages(messages: ChatMessage[]): {
    messages: ChatMessage[];
    tracker: TokenBudgetTracker;
  } {
    const tracker = new TokenBudgetTracker(this.budgetConfig);

    if (messages.length === 0) {
      return { messages: [], tracker };
    }

    // 1. Clone messages to avoid mutating the caller's array
    const cloned = messages.map(m => ({ ...m }));

    // 2. Account for system prompt
    const systemMessage = cloned[0]?.role === 'system' ? cloned[0] : null;
    if (systemMessage) {
      const systemTokens = estimateMessageTokens(systemMessage);

      // Truncate system prompt if it exceeds its budget
      if (systemTokens > this.budgetConfig.maxSystemPromptTokens) {
        systemMessage.content = truncateToTokenBudget(
          systemMessage.content,
          this.budgetConfig.maxSystemPromptTokens,
          'tail'
        );
        tracker.recordSystemPrompt(this.budgetConfig.maxSystemPromptTokens);
        logger.warn(
          `[ContextWindowManager] System prompt truncated from ${systemTokens} to ${this.budgetConfig.maxSystemPromptTokens} tokens`
        );
      } else {
        tracker.recordSystemPrompt(systemTokens);
      }
    }

    // 3. Account for the user's latest message (if last message is user role)
    const lastMessage = cloned[cloned.length - 1];
    const lastIsUser = lastMessage?.role === 'user';
    if (lastIsUser) {
      const userTokens = estimateMessageTokens(lastMessage);
      if (userTokens > this.budgetConfig.maxUserMessageTokens) {
        lastMessage.content = truncateToTokenBudget(
          lastMessage.content,
          this.budgetConfig.maxUserMessageTokens,
          'tail'
        );
        tracker.recordUserMessage(this.budgetConfig.maxUserMessageTokens);
      } else {
        tracker.recordUserMessage(userTokens);
      }
    }

    // 4. Prune history (everything between system prompt and latest user message)
    const historyBudget = tracker.availableForHistory();
    const historyStart = systemMessage ? 1 : 0;
    // If the last message is a user message, exclude it from history (it's appended separately)
    const historyEnd = lastIsUser ? cloned.length - 1 : cloned.length;
    const historyMessages = cloned.slice(historyStart, historyEnd);

    const prunedHistory = pruneHistory(historyMessages, historyBudget);
    tracker.recordHistory(estimateConversationTokens(prunedHistory));

    // 5. Reassemble messages
    const prepared: ChatMessage[] = [];
    if (systemMessage) prepared.push(systemMessage);
    prepared.push(...prunedHistory);
    if (lastIsUser) {
      prepared.push(lastMessage);
    }

    tracker.logState('prepared');

    return { messages: prepared, tracker };
  }

  /**
   * Truncate a tool result to fit within the budget.
   *
   * Call this before feeding a tool result back into the messages array.
   * Uses the tracker to respect both per-tool and cumulative budgets.
   */
  truncateToolResultForBudget(
    data: unknown,
    tracker: TokenBudgetTracker
  ): string {
    const maxTokens = tracker.availableForNextToolResult();

    if (maxTokens <= 0) {
      const placeholder = '[Tool result omitted — token budget exceeded]';
      logger.warn('[ContextWindowManager] Tool result budget exhausted, returning placeholder');
      tracker.recordToolResult(estimateTokenCount(placeholder));
      return placeholder;
    }

    // Guard against undefined/null data (when both toolResult.data and .error are nullish)
    const safeData = data ?? '[No data returned]';
    const truncated = truncateToolResult(safeData, maxTokens);
    const actualTokens = estimateTokenCount(truncated);
    tracker.recordToolResult(actualTokens);

    return truncated;
  }

  /**
   * Get the maximum output tokens to request from the model.
   * Respects the model's capabilities and the budget config.
   */
  getMaxOutputTokens(requested?: number): number {
    const modelMax = this.profile.maxOutputTokens;
    const budgetMax = this.budgetConfig.reservedForOutput;
    const effective = Math.min(modelMax, budgetMax);

    if (requested) {
      return Math.min(requested, effective);
    }
    return effective;
  }

  /**
   * Check whether the model supports native tool calling.
   * Small models typically don't, so the system should use text-based
   * tool calls (```tool_call blocks) instead.
   */
  supportsNativeToolCalling(): boolean {
    return this.profile.supportsToolCalling;
  }

  /**
   * Check whether the model can produce reliable structured JSON output.
   * Small models may need simpler output formats.
   */
  supportsStructuredOutput(): boolean {
    return this.profile.supportsStructuredOutput;
  }
}

/**
 * Token Budget — Context Window Management
 *
 * Provides token estimation, budgeting, and smart truncation for AI context.
 * Prevents overflowing the model's context window by:
 *  1. Estimating token counts for messages, tool results, and prompts
 *  2. Enforcing per-component budgets (system prompt, history, tool results)
 *  3. Intelligently truncating oversized content (summarization-ready)
 *
 * The 200-token fallback in PersonaRouter is a safety net, but this module
 * provides the real per-call budget discipline the system needs.
 */

import { ChatMessage } from './types';
import { logger } from '@/utils/logger';

// ── Token Budget Configuration ──────────────────────────────────────────

export interface TokenBudgetConfig {
  /** Total context window size for the active model (tokens) */
  contextWindowSize: number;
  /** Tokens reserved for the model's output (response) */
  reservedForOutput: number;
  /** Maximum tokens for the system prompt */
  maxSystemPromptTokens: number;
  /** Maximum tokens for conversation history */
  maxHistoryTokens: number;
  /** Maximum tokens for a single tool result */
  maxToolResultTokens: number;
  /** Maximum tokens for all tool results combined in one request */
  maxTotalToolResultTokens: number;
  /** Maximum tokens for the user's current message (including UI context) */
  maxUserMessageTokens: number;
}

/** Sensible defaults for large models (128k+ context) */
export const LARGE_MODEL_BUDGET: TokenBudgetConfig = {
  contextWindowSize: 128000,
  reservedForOutput: 4096,
  maxSystemPromptTokens: 4000,
  maxHistoryTokens: 40000,
  maxToolResultTokens: 8000,
  maxTotalToolResultTokens: 24000,
  maxUserMessageTokens: 4000,
};

/** Budget for medium models (32k-64k context) */
export const MEDIUM_MODEL_BUDGET: TokenBudgetConfig = {
  contextWindowSize: 32000,
  reservedForOutput: 2048,
  maxSystemPromptTokens: 2000,
  maxHistoryTokens: 10000,
  maxToolResultTokens: 3000,
  maxTotalToolResultTokens: 9000,
  maxUserMessageTokens: 2000,
};

/**
 * Budget for small models (4k-8k context, e.g. Llama 3B, Mistral 7B).
 * Available input = 8000 - 1024 = 6976 tokens.
 * Component sum = 1000 + 1800 + 2800 + 800 = 6400 (fits within 6976).
 */
export const SMALL_MODEL_BUDGET: TokenBudgetConfig = {
  contextWindowSize: 8000,
  reservedForOutput: 1024,
  maxSystemPromptTokens: 1000,
  maxHistoryTokens: 1800,
  maxToolResultTokens: 1200,
  maxTotalToolResultTokens: 2800,
  maxUserMessageTokens: 800,
};

// ── Token Estimation ────────────────────────────────────────────────────

/**
 * Characters-per-token ratio for the heuristic estimator.
 * ~4 for English prose, ~3.5 for code-heavy content.
 * 3.8 is a safe middle ground that slightly over-estimates.
 */
const CHARS_PER_TOKEN = 3.8;

/**
 * Estimate the token count for a text string.
 *
 * Uses a character-ratio heuristic calibrated for mixed English/code content.
 * For production accuracy, swap in tiktoken or the provider's tokenizer.
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate tokens for a ChatMessage (role label + content + tool metadata).
 */
export function estimateMessageTokens(message: ChatMessage): number {
  // Every message has overhead: role tokens, formatting tokens
  const OVERHEAD = 4; // ~4 tokens for role, separators
  let tokens = OVERHEAD + estimateTokenCount(message.content);

  if (message.toolCalls) {
    for (const call of message.toolCalls) {
      tokens += estimateTokenCount(call.name);
      tokens += estimateTokenCount(JSON.stringify(call.arguments));
    }
  }

  if (message.name) {
    tokens += estimateTokenCount(message.name);
  }

  return tokens;
}

/**
 * Estimate total tokens for an array of messages.
 */
export function estimateConversationTokens(messages: ChatMessage[]): number {
  // Conversation-level overhead (BOS/EOS markers, etc.)
  const CONVERSATION_OVERHEAD = 3;
  return CONVERSATION_OVERHEAD + messages.reduce(
    (total, msg) => total + estimateMessageTokens(msg),
    0
  );
}

// ── Smart Truncation ────────────────────────────────────────────────────

/**
 * Truncation strategy for different content types.
 */
export type TruncationStrategy = 'tail' | 'head' | 'middle' | 'smart_log';

/**
 * Truncate text to fit within a token budget.
 *
 * @param text The text to truncate
 * @param maxTokens Maximum tokens allowed
 * @param strategy How to truncate
 * @returns Truncated text with a marker indicating truncation
 */
export function truncateToTokenBudget(
  text: string,
  maxTokens: number,
  strategy: TruncationStrategy = 'tail'
): string {
  const currentTokens = estimateTokenCount(text);
  if (currentTokens <= maxTokens) return text;

  // Convert token budget to approximate character limit
  const maxChars = Math.floor(maxTokens * CHARS_PER_TOKEN);
  const marker = '\n\n... [truncated — content exceeded token budget] ...';
  const markerLen = marker.length;
  const usableChars = maxChars - markerLen;

  if (usableChars <= 0) return marker;

  switch (strategy) {
    case 'head':
      // Keep the end of the content (most recent)
      return marker + '\n' + text.slice(-usableChars);

    case 'middle':
      // Keep beginning and end, cut the middle
      const halfChars = Math.floor(usableChars / 2);
      return text.slice(0, halfChars) + marker + text.slice(-halfChars);

    case 'smart_log':
      return truncateLogSmart(text, usableChars, marker);

    case 'tail':
    default:
      // Keep the beginning of the content
      return text.slice(0, usableChars) + marker;
  }
}

/**
 * Smart log truncation: keeps error/exception lines from anywhere in the log,
 * plus the most recent lines. This preserves the most diagnostic value.
 */
function truncateLogSmart(text: string, maxChars: number, marker: string): string {
  const lines = text.split('\n');

  // Extract high-signal lines (errors, exceptions, failures, assertions)
  const errorPatterns = /\b(error|exception|failed|fatal|assert|panic|segfault|abort|stack\s*trace|caused\s*by|traceback)\b/i;
  const errorLines: string[] = [];
  const recentLines: string[] = [];

  // Collect error lines from the entire log
  for (const line of lines) {
    if (errorPatterns.test(line)) {
      errorLines.push(line);
    }
  }

  // Budget: 40% for error lines, 60% for recent lines
  const errorBudget = Math.floor(maxChars * 0.4);
  const recentBudget = maxChars - errorBudget;

  // Take error lines up to budget
  let errorText = '';
  for (const line of errorLines) {
    if (errorText.length + line.length + 1 > errorBudget) break;
    errorText += line + '\n';
  }

  // Take recent lines up to budget
  let recentText = '';
  for (let i = lines.length - 1; i >= 0; i--) {
    if (recentText.length + lines[i].length + 1 > recentBudget) break;
    recentText = lines[i] + '\n' + recentText;
  }

  if (errorText) {
    return '--- Key error lines ---\n' + errorText + marker + '\n--- Recent output ---\n' + recentText;
  }

  return marker + '\n' + recentText;
}

// ── Tool Result Truncation ──────────────────────────────────────────────

/**
 * Truncate a tool result's data to fit within a token budget.
 * Handles JSON objects/arrays by selectively trimming fields.
 */
export function truncateToolResult(
  data: unknown,
  maxTokens: number
): string {
  // Safely serialize — catch circular references
  let serialized: string;
  if (typeof data === 'string') {
    serialized = data;
  } else {
    try {
      serialized = JSON.stringify(data);
    } catch {
      serialized = String(data);
    }
  }

  const currentTokens = estimateTokenCount(serialized);
  if (currentTokens <= maxTokens) return serialized;

  // For JSON objects/arrays, try to preserve structure but trim values
  if (typeof data === 'object' && data !== null) {
    return truncateJsonStructure(data, maxTokens);
  }

  // For plain strings, use tail truncation
  return truncateToTokenBudget(serialized, maxTokens, 'tail');
}

/**
 * Truncate a JSON structure while preserving its skeleton.
 * Keeps keys and short values, truncates long string values and arrays.
 */
function truncateJsonStructure(data: unknown, maxTokens: number): string {
  const maxChars = Math.floor(maxTokens * CHARS_PER_TOKEN);

  function truncateValue(value: unknown, budget: number): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value === 'boolean' || typeof value === 'number') return value;

    if (typeof value === 'string') {
      if (value.length <= budget) return value;
      return value.slice(0, budget) + '...';
    }

    if (Array.isArray(value)) {
      // Keep first N items that fit the budget
      const result: unknown[] = [];
      let usedChars = 2; // [ ]
      for (const item of value) {
        const itemStr = JSON.stringify(item);
        if (usedChars + itemStr.length > budget) {
          result.push(`... (${value.length - result.length} more items)`);
          break;
        }
        result.push(truncateValue(item, Math.floor(budget / value.length)));
        usedChars += itemStr.length + 1;
      }
      return result;
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const entries = Object.entries(obj);
      const result: Record<string, unknown> = {};
      let usedChars = 2; // { }
      const perKeyBudget = Math.floor(budget / Math.max(entries.length, 1));

      for (const [key, val] of entries) {
        const keyChars = key.length + 3; // "key":
        if (usedChars + keyChars > budget) {
          result['...'] = `${entries.length - Object.keys(result).length} more fields`;
          break;
        }
        result[key] = truncateValue(val, perKeyBudget);
        usedChars += keyChars + JSON.stringify(result[key]).length;
      }
      return result;
    }

    return value;
  }

  const truncated = truncateValue(data, maxChars);
  return JSON.stringify(truncated, null, 0);
}

// ── Token Budget Tracker ────────────────────────────────────────────────

/**
 * Tracks token usage across components of a single LLM request.
 * Call `canFit()` before adding content, and `record()` after.
 */
export class TokenBudgetTracker {
  private config: TokenBudgetConfig;
  private usage: {
    systemPrompt: number;
    history: number;
    toolResults: number;
    userMessage: number;
  };

  constructor(config: TokenBudgetConfig) {
    this.config = config;
    this.usage = {
      systemPrompt: 0,
      history: 0,
      toolResults: 0,
      userMessage: 0,
    };
  }

  /** Available tokens for the entire input (context window minus reserved output) */
  get availableInputTokens(): number {
    return this.config.contextWindowSize - this.config.reservedForOutput;
  }

  /** Total tokens used so far across all components */
  get totalUsed(): number {
    return this.usage.systemPrompt + this.usage.history + this.usage.toolResults + this.usage.userMessage;
  }

  /** Remaining tokens before hitting the input budget */
  get remaining(): number {
    return Math.max(0, this.availableInputTokens - this.totalUsed);
  }

  /** Record system prompt token usage */
  recordSystemPrompt(tokens: number): void {
    this.usage.systemPrompt = tokens;
  }

  /** Record history token usage */
  recordHistory(tokens: number): void {
    this.usage.history = tokens;
  }

  /** Record a tool result's token count */
  recordToolResult(tokens: number): void {
    this.usage.toolResults += tokens;
  }

  /** Record user message token usage */
  recordUserMessage(tokens: number): void {
    this.usage.userMessage = tokens;
  }

  /**
   * Record tokens added during the ReAct loop (assistant responses,
   * synthetic user messages, error tool messages) that aren't covered
   * by the specific component recorders above.
   */
  recordLoopOverhead(tokens: number): void {
    this.usage.history += tokens;
  }

  /**
   * Check how many tokens are available for the next tool result,
   * respecting both per-tool and total tool result budgets.
   */
  availableForNextToolResult(): number {
    const perToolBudget = this.config.maxToolResultTokens;
    const totalToolBudget = this.config.maxTotalToolResultTokens - this.usage.toolResults;
    const globalBudget = this.remaining;

    return Math.max(0, Math.min(perToolBudget, totalToolBudget, globalBudget));
  }

  /**
   * Check how many tokens are available for conversation history.
   */
  availableForHistory(): number {
    return Math.min(this.config.maxHistoryTokens, this.remaining);
  }

  /**
   * Get a summary of token usage for logging/debugging.
   */
  getSummary(): Record<string, number> {
    return {
      contextWindow: this.config.contextWindowSize,
      reservedForOutput: this.config.reservedForOutput,
      availableInput: this.availableInputTokens,
      systemPrompt: this.usage.systemPrompt,
      history: this.usage.history,
      toolResults: this.usage.toolResults,
      userMessage: this.usage.userMessage,
      totalUsed: this.totalUsed,
      remaining: this.remaining,
    };
  }

  /**
   * Log the current budget state at debug level.
   */
  logState(label: string): void {
    logger.debug(`[TokenBudget:${label}]`, this.getSummary());
  }
}

// ── History Pruning ─────────────────────────────────────────────────────

/**
 * Prune conversation history to fit within a token budget.
 * Keeps the most recent messages, dropping oldest ones first.
 * Always preserves the system prompt (first message).
 */
export function pruneHistory(
  messages: ChatMessage[],
  maxTokens: number
): ChatMessage[] {
  if (messages.length === 0) return [];

  const totalTokens = estimateConversationTokens(messages);
  if (totalTokens <= maxTokens) return messages;

  // Always keep the system prompt if present
  const hasSystem = messages[0].role === 'system';
  const systemMessage = hasSystem ? messages[0] : null;
  const rest = hasSystem ? messages.slice(1) : [...messages];

  const systemTokens = systemMessage ? estimateMessageTokens(systemMessage) : 0;
  let budget = maxTokens - systemTokens;

  // Walk backwards from the most recent message, adding until budget is spent
  const kept: ChatMessage[] = [];
  for (let i = rest.length - 1; i >= 0; i--) {
    const msgTokens = estimateMessageTokens(rest[i]);
    if (budget - msgTokens < 0 && kept.length > 0) break;
    kept.unshift(rest[i]);
    budget -= msgTokens;
  }

  logger.debug(
    `[TokenBudget] Pruned history from ${messages.length} to ${kept.length + (systemMessage ? 1 : 0)} messages ` +
    `(${totalTokens} → ~${maxTokens} tokens)`
  );

  return systemMessage ? [systemMessage, ...kept] : kept;
}

// ── Budget Selection Helper ─────────────────────────────────────────────

/**
 * Select the appropriate token budget based on a model's context window size.
 */
export function selectBudgetForContextWindow(contextWindowSize: number): TokenBudgetConfig {
  if (contextWindowSize >= 64000) {
    return { ...LARGE_MODEL_BUDGET, contextWindowSize };
  }
  if (contextWindowSize >= 16000) {
    return { ...MEDIUM_MODEL_BUDGET, contextWindowSize };
  }
  return { ...SMALL_MODEL_BUDGET, contextWindowSize };
}

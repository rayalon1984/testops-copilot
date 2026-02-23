/**
 * Tests for Token Budget — Context Window Management
 */
import {
  estimateTokenCount,
  estimateMessageTokens,
  estimateConversationTokens,
  truncateToTokenBudget,
  truncateToolResult,
  pruneHistory,
  selectBudgetForContextWindow,
  TokenBudgetTracker,
  LARGE_MODEL_BUDGET,
  MEDIUM_MODEL_BUDGET,
  SMALL_MODEL_BUDGET,
} from '../token-budget';
import { ChatMessage } from '../types';

// ── Token Estimation ──

describe('estimateTokenCount', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokenCount('')).toBe(0);
  });

  it('returns 0 for null/undefined input', () => {
    expect(estimateTokenCount(null as unknown as string)).toBe(0);
    expect(estimateTokenCount(undefined as unknown as string)).toBe(0);
  });

  it('estimates short text', () => {
    // "hello" = 5 chars → ceil(5/3.8) = 2 tokens
    const tokens = estimateTokenCount('hello');
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(5);
  });

  it('estimates longer text proportionally', () => {
    const short = estimateTokenCount('hello');
    const long = estimateTokenCount('hello world, this is a longer text');
    expect(long).toBeGreaterThan(short);
  });
});

describe('estimateMessageTokens', () => {
  it('includes overhead for role', () => {
    const msg: ChatMessage = { role: 'user', content: '' };
    const tokens = estimateMessageTokens(msg);
    // Should have at least the overhead (4 tokens)
    expect(tokens).toBeGreaterThanOrEqual(4);
  });

  it('counts content tokens', () => {
    const msg: ChatMessage = { role: 'user', content: 'What are my test failures?' };
    const tokens = estimateMessageTokens(msg);
    expect(tokens).toBeGreaterThan(4);
  });

  it('includes tool call tokens', () => {
    const withoutTools: ChatMessage = { role: 'assistant', content: 'text' };
    const withTools: ChatMessage = {
      role: 'assistant',
      content: 'text',
      toolCalls: [{ id: '1', name: 'jira_search', arguments: { query: 'test' } }],
    };
    expect(estimateMessageTokens(withTools)).toBeGreaterThan(estimateMessageTokens(withoutTools));
  });
});

describe('estimateConversationTokens', () => {
  it('returns overhead for empty array', () => {
    expect(estimateConversationTokens([])).toBe(3);
  });

  it('sums message tokens plus overhead', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a helper.' },
      { role: 'user', content: 'Hi' },
    ];
    const total = estimateConversationTokens(messages);
    expect(total).toBeGreaterThan(0);
  });
});

// ── Truncation ──

describe('truncateToTokenBudget', () => {
  it('returns text unchanged if within budget', () => {
    const text = 'short text';
    const result = truncateToTokenBudget(text, 100);
    expect(result).toBe(text);
  });

  it('truncates long text with tail strategy', () => {
    const text = 'x'.repeat(10000);
    const result = truncateToTokenBudget(text, 50, 'tail');
    expect(result.length).toBeLessThan(text.length);
    expect(result).toContain('truncated');
  });

  it('truncates with head strategy (keeps end)', () => {
    const text = 'START' + 'x'.repeat(10000) + 'END';
    const result = truncateToTokenBudget(text, 50, 'head');
    expect(result).toContain('END');
    expect(result).toContain('truncated');
  });

  it('truncates with middle strategy (keeps start and end)', () => {
    const text = 'START' + 'x'.repeat(10000) + 'END';
    const result = truncateToTokenBudget(text, 50, 'middle');
    expect(result).toContain('START');
    expect(result).toContain('END');
    expect(result).toContain('truncated');
  });

  it('truncates logs with smart_log strategy', () => {
    const logLines = [
      'INFO: Starting test...',
      'INFO: Loading fixtures...',
      'ERROR: NullPointerException at line 42',
      'INFO: More processing...',
      ...Array(100).fill('INFO: Regular log line'),
      'FATAL: Test failed',
      'INFO: Cleanup complete',
    ];
    const text = logLines.join('\n');
    const result = truncateToTokenBudget(text, 100, 'smart_log');
    // Should preserve error lines
    expect(result).toContain('ERROR');
    expect(result).toContain('FATAL');
  });
});

describe('truncateToolResult', () => {
  it('returns JSON unchanged if within budget', () => {
    const data = { status: 'ok', count: 5 };
    const result = truncateToolResult(data, 100);
    expect(JSON.parse(result)).toEqual(data);
  });

  it('truncates large JSON objects', () => {
    const data = {
      issues: Array(100).fill({ key: 'PROJ-123', summary: 'A very long summary '.repeat(10) }),
    };
    const result = truncateToolResult(data, 200);
    expect(estimateTokenCount(result)).toBeLessThanOrEqual(250); // some margin
  });

  it('handles string data', () => {
    const data = 'x'.repeat(10000);
    const result = truncateToolResult(data, 50);
    expect(result.length).toBeLessThan(data.length);
  });
});

// ── History Pruning ──

describe('pruneHistory', () => {
  it('returns all messages if within budget', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ];
    const result = pruneHistory(messages, 10000);
    expect(result).toHaveLength(3);
  });

  it('preserves system message when pruning', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'Important system prompt' },
      ...Array(20).fill(null).map((_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `Message ${i}: ${'x'.repeat(500)}`,
      })),
    ];
    const result = pruneHistory(messages, 200);
    expect(result[0].role).toBe('system');
    expect(result.length).toBeLessThan(messages.length);
  });

  it('keeps most recent messages when pruning', () => {
    const messages: ChatMessage[] = Array(10).fill(null).map((_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i}`,
    }));
    const result = pruneHistory(messages, 50);
    // Last message should be preserved
    expect(result[result.length - 1].content).toBe('Message 9');
  });
});

// ── Budget Selection ──

describe('selectBudgetForContextWindow', () => {
  it('selects large budget for 128k+ models', () => {
    const budget = selectBudgetForContextWindow(128000);
    expect(budget.maxHistoryTokens).toBe(LARGE_MODEL_BUDGET.maxHistoryTokens);
    expect(budget.contextWindowSize).toBe(128000);
  });

  it('selects medium budget for 32k models', () => {
    const budget = selectBudgetForContextWindow(32000);
    expect(budget.maxHistoryTokens).toBe(MEDIUM_MODEL_BUDGET.maxHistoryTokens);
  });

  it('selects small budget for 8k models', () => {
    const budget = selectBudgetForContextWindow(8000);
    expect(budget.maxHistoryTokens).toBe(SMALL_MODEL_BUDGET.maxHistoryTokens);
  });
});

// ── Budget Tracker ──

describe('TokenBudgetTracker', () => {
  it('tracks usage across components', () => {
    const tracker = new TokenBudgetTracker(LARGE_MODEL_BUDGET);
    tracker.recordSystemPrompt(2000);
    tracker.recordHistory(10000);
    tracker.recordUserMessage(500);

    expect(tracker.totalUsed).toBe(12500);
    expect(tracker.remaining).toBeGreaterThan(0);
  });

  it('limits tool result budget', () => {
    const tracker = new TokenBudgetTracker(SMALL_MODEL_BUDGET);
    tracker.recordSystemPrompt(1000);
    tracker.recordHistory(2000);
    tracker.recordUserMessage(500);

    const available = tracker.availableForNextToolResult();
    expect(available).toBeLessThanOrEqual(SMALL_MODEL_BUDGET.maxToolResultTokens);
    expect(available).toBeGreaterThanOrEqual(0);
  });

  it('reports zero when budget exhausted', () => {
    const tracker = new TokenBudgetTracker({
      ...SMALL_MODEL_BUDGET,
      contextWindowSize: 100,
      reservedForOutput: 50,
    });
    tracker.recordSystemPrompt(40);
    tracker.recordHistory(10);

    expect(tracker.remaining).toBe(0);
    expect(tracker.availableForNextToolResult()).toBe(0);
  });

  it('provides summary for logging', () => {
    const tracker = new TokenBudgetTracker(MEDIUM_MODEL_BUDGET);
    tracker.recordSystemPrompt(1500);
    const summary = tracker.getSummary();

    expect(summary.systemPrompt).toBe(1500);
    expect(summary.contextWindow).toBe(MEDIUM_MODEL_BUDGET.contextWindowSize);
    expect(summary.remaining).toBeGreaterThan(0);
  });
});

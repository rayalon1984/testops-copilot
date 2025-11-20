/**
 * Unit Tests - Categorization and Log Summarization Services
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CategorizationService } from '../../../src/services/ai/features/categorization';
import { LogSummarizationService } from '../../../src/services/ai/features/log-summary';
import { BaseProvider } from '../../../src/services/ai/providers/base.provider';
import { TestFailure, AIResponse, ChatMessage, FailureCategory } from '../../../src/services/ai/types';

// Mock provider for testing
class MockProvider extends BaseProvider {
  private mockResponse: string = '';

  setMockResponse(response: string) {
    this.mockResponse = response;
  }

  getName() {
    return 'anthropic' as const;
  }

  getPricing() {
    return {
      inputTokenCostPer1k: 0.01,
      outputTokenCostPer1k: 0.03,
    };
  }

  getLimits() {
    return {
      maxInputTokens: 100000,
      maxOutputTokens: 4096,
      requestsPerMinute: 50,
      tokensPerMinute: 40000,
    };
  }

  async chat(messages: ChatMessage[]): Promise<AIResponse> {
    return {
      content: this.mockResponse,
      provider: this.getName(),
      model: 'test-model',
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      },
      cost: this.calculateCost(100, 50),
      cached: false,
      responseTimeMs: 100,
    };
  }

  async embed(text: string): Promise<number[]> {
    return new Array(1536).fill(0.1);
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

describe('CategorizationService', () => {
  let provider: MockProvider;
  let service: CategorizationService;

  beforeEach(() => {
    provider = new MockProvider({
      apiKey: 'test-key',
      model: 'test-model',
    });
    service = new CategorizationService(provider);
  });

  describe('categorizeFailure', () => {
    it('should categorize a critical bug correctly', async () => {
      provider.setMockResponse(JSON.stringify({
        category: 'bug_critical',
        confidence: 0.95,
        reasoning: 'NullPointerException indicates a critical bug',
        suggestedAction: 'Fix null reference immediately',
        relatedIssues: ['NPE', 'null safety'],
      }));

      const failure: TestFailure = {
        id: '1',
        testId: 'test-1',
        testName: 'Login Test',
        errorMessage: 'NullPointerException: Cannot invoke method on null',
        pipeline: 'main',
        branch: 'main',
        commitHash: 'abc123',
        timestamp: new Date(),
      };

      const result = await service.categorizeFailure(failure);

      expect(result.category).toBe('bug_critical');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.reasoning).toContain('critical');
      expect(result.suggestedAction).toBeTruthy();
    });

    it('should categorize environment issues', async () => {
      provider.setMockResponse(JSON.stringify({
        category: 'environment',
        confidence: 0.88,
        reasoning: 'Connection timeout indicates environment issue',
        suggestedAction: 'Check network connectivity',
      }));

      const failure: TestFailure = {
        id: '2',
        testId: 'test-2',
        testName: 'API Test',
        errorMessage: 'Connection timeout after 30 seconds',
        pipeline: 'staging',
        branch: 'develop',
        commitHash: 'def456',
        timestamp: new Date(),
      };

      const result = await service.categorizeFailure(failure);

      expect(result.category).toBe('environment');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should categorize flaky tests', async () => {
      provider.setMockResponse(JSON.stringify({
        category: 'flaky',
        confidence: 0.82,
        reasoning: 'Race condition suggests flaky test',
        suggestedAction: 'Add synchronization or waits',
      }));

      const failure: TestFailure = {
        id: '3',
        testId: 'test-3',
        testName: 'UI Test',
        errorMessage: 'Element not found - timing issue',
        pipeline: 'main',
        branch: 'main',
        commitHash: 'ghi789',
        timestamp: new Date(),
      };

      const result = await service.categorizeFailure(failure);

      expect(result.category).toBe('flaky');
    });

    it('should handle invalid JSON response gracefully', async () => {
      provider.setMockResponse('This is not valid JSON');

      const failure: TestFailure = {
        id: '4',
        testId: 'test-4',
        testName: 'Test',
        errorMessage: 'Error',
        pipeline: 'main',
        branch: 'main',
        commitHash: 'xyz',
        timestamp: new Date(),
      };

      const result = await service.categorizeFailure(failure);

      expect(result.category).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    it('should normalize category variations', async () => {
      provider.setMockResponse(JSON.stringify({
        category: 'CRITICAL BUG',
        confidence: 0.9,
        reasoning: 'Test',
        suggestedAction: 'Fix',
      }));

      const failure: TestFailure = {
        id: '5',
        testId: 'test-5',
        testName: 'Test',
        errorMessage: 'Error',
        pipeline: 'main',
        branch: 'main',
        commitHash: 'xyz',
        timestamp: new Date(),
      };

      const result = await service.categorizeFailure(failure);

      expect(result.category).toBe('bug_critical');
    });
  });

  describe('categorizeFailures (batch)', () => {
    it('should categorize multiple failures', async () => {
      provider.setMockResponse(JSON.stringify({
        category: 'bug_minor',
        confidence: 0.75,
        reasoning: 'Minor UI issue',
        suggestedAction: 'Fix when convenient',
      }));

      const failures: TestFailure[] = [
        {
          id: '1',
          testId: 'test-1',
          testName: 'Test 1',
          errorMessage: 'Error 1',
          pipeline: 'main',
          branch: 'main',
          commitHash: 'a',
          timestamp: new Date(),
        },
        {
          id: '2',
          testId: 'test-2',
          testName: 'Test 2',
          errorMessage: 'Error 2',
          pipeline: 'main',
          branch: 'main',
          commitHash: 'b',
          timestamp: new Date(),
        },
      ];

      const results = await service.categorizeFailures(failures);

      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.category).toBeTruthy();
        expect(result.confidence).toBeGreaterThanOrEqual(0);
      });
    });
  });
});

describe('LogSummarizationService', () => {
  let provider: MockProvider;
  let service: LogSummarizationService;

  beforeEach(() => {
    provider = new MockProvider({
      apiKey: 'test-key',
      model: 'test-model',
    });
    service = new LogSummarizationService(provider);
  });

  describe('summarizeLogs', () => {
    it('should summarize logs correctly', async () => {
      provider.setMockResponse(JSON.stringify({
        summary: 'Test failed due to database connection error',
        rootCause: 'Database connection pool exhausted',
        errorLocation: {
          file: 'src/db/connection.ts',
          line: 45,
          snippet: 'await pool.connect()',
        },
        keyLogLines: [
          {
            lineNumber: 100,
            content: 'ERROR: Connection timeout',
            relevance: 'high',
          },
          {
            lineNumber: 101,
            content: 'Stack trace: ...',
            relevance: 'medium',
          },
        ],
        suggestedFix: 'Increase connection pool size or add connection retry logic',
        confidence: 0.92,
      }));

      const logs = `
        [INFO] Starting test
        [ERROR] Connection timeout
        [ERROR] Stack trace: ...
        [INFO] Test failed
      `;

      const result = await service.summarizeLogs(
        logs,
        'Database Test',
        'Connection timeout'
      );

      expect(result.summary).toContain('database');
      expect(result.rootCause).toContain('connection');
      expect(result.errorLocation).toBeDefined();
      expect(result.errorLocation?.file).toBe('src/db/connection.ts');
      expect(result.keyLogLines).toHaveLength(2);
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should handle long logs by preprocessing', async () => {
      provider.setMockResponse(JSON.stringify({
        summary: 'Test summary',
        rootCause: 'Root cause',
        keyLogLines: [],
        suggestedFix: 'Fix suggestion',
        confidence: 0.8,
      }));

      const longLogs = 'x'.repeat(100000); // 100k characters

      const result = await service.summarizeLogs(
        longLogs,
        'Test',
        'Error'
      );

      expect(result).toBeDefined();
      expect(result.summary).toBeTruthy();
    });

    it('should generate hash for caching', () => {
      const logs = 'test logs content';
      const hash1 = service.generateLogHash(logs);
      const hash2 = service.generateLogHash(logs);
      const hash3 = service.generateLogHash(logs + ' different');

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
    });

    it('should handle invalid JSON gracefully', async () => {
      provider.setMockResponse('Not valid JSON');

      const result = await service.summarizeLogs(
        'test logs',
        'Test',
        'Error'
      );

      expect(result.summary).toBeTruthy();
      expect(result.rootCause).toBeTruthy();
      expect(result.confidence).toBeLessThan(1);
    });
  });

  describe('summarizeMultiple', () => {
    it('should batch summarize multiple logs', async () => {
      provider.setMockResponse(JSON.stringify({
        summary: 'Summary',
        rootCause: 'Cause',
        keyLogLines: [],
        suggestedFix: 'Fix',
        confidence: 0.8,
      }));

      const items = [
        { logs: 'logs1', testName: 'Test1', errorMessage: 'Error1' },
        { logs: 'logs2', testName: 'Test2', errorMessage: 'Error2' },
      ];

      const results = await service.summarizeMultiple(items);

      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.summary).toBeTruthy();
        expect(result.rootCause).toBeTruthy();
      });
    });
  });

  describe('compareSummaries', () => {
    it('should calculate similarity between summaries', () => {
      const summary1 = {
        summary: 'Test',
        rootCause: 'database connection timeout error',
        keyLogLines: [],
        suggestedFix: 'Fix',
        confidence: 0.9,
      };

      const summary2 = {
        summary: 'Test',
        rootCause: 'database connection timeout problem',
        keyLogLines: [],
        suggestedFix: 'Fix',
        confidence: 0.9,
      };

      const summary3 = {
        summary: 'Test',
        rootCause: 'network issue unrelated',
        keyLogLines: [],
        suggestedFix: 'Fix',
        confidence: 0.9,
      };

      const similarity12 = service.compareSummaries(summary1, summary2);
      const similarity13 = service.compareSummaries(summary1, summary3);

      expect(similarity12).toBeGreaterThan(similarity13);
      expect(similarity12).toBeGreaterThan(0.5);
    });
  });
});

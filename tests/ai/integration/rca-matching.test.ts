/**
 * Integration Tests - RCA Matching
 *
 * Tests for the complete RCA matching workflow including
 * embedding generation, vector search, and AI analysis.
 *
 * Note: These tests require:
 * - A running Weaviate instance
 * - Valid AI provider API key (mocked in test environment)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool } from 'pg';
import { initializeAI, shutdownAI, getAIManager } from '../../../src/services/ai';
import { TestFailure } from '../../../src/services/ai/types';

describe('RCA Matching Integration', () => {
  let db: Pool;
  let aiManagerInitialized = false;

  beforeAll(async () => {
    // Setup test database
    db = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'testops_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    // Initialize AI services if enabled
    if (process.env.AI_ENABLED === 'true') {
      try {
        await initializeAI({ db });
        aiManagerInitialized = true;
      } catch (error) {
        console.warn('AI services not available for integration tests:', error);
      }
    }
  });

  afterAll(async () => {
    if (aiManagerInitialized) {
      await shutdownAI();
    }
    await db.end();
  });

  describe('Store and Retrieve Failures', () => {
    it('should store a test failure', async () => {
      if (!aiManagerInitialized) {
        console.log('Skipping: AI not enabled');
        return;
      }

      const manager = getAIManager();

      const failure: TestFailure = {
        id: '',
        testId: 'test-001',
        testName: 'Login Test',
        errorMessage: 'AssertionError: Expected status 200 but got 500',
        stackTrace: 'at LoginPage.login (login.ts:45)\nat test (test.ts:12)',
        pipeline: 'main-pipeline',
        branch: 'main',
        commitHash: 'abc123',
        timestamp: new Date(),
      };

      const id = await manager.storeFailure(failure);

      expect(id).toBeDefined();
      expect(id.length).toBeGreaterThan(0);
    });

    it('should find similar failures', async () => {
      if (!aiManagerInitialized) {
        console.log('Skipping: AI not enabled');
        return;
      }

      const manager = getAIManager();

      // Store a resolved failure
      const resolvedFailure: TestFailure = {
        id: '',
        testId: 'test-002',
        testName: 'Login Test',
        errorMessage: 'AssertionError: Expected status 200 but got 500',
        stackTrace: 'at LoginPage.login (login.ts:45)\nat test (test.ts:12)',
        pipeline: 'main-pipeline',
        branch: 'main',
        commitHash: 'def456',
        timestamp: new Date(),
      };

      const storedId = await manager.storeFailure(resolvedFailure);
      await manager.markFailureAsResolved(
        storedId,
        'Fixed by updating API endpoint',
        'developer@example.com',
        'https://jira.example.com/ISSUE-123'
      );

      // Search for similar failure
      const newFailure: TestFailure = {
        id: '',
        testId: 'test-003',
        testName: 'Login Test',
        errorMessage: 'AssertionError: Expected status 200 but got 500',
        stackTrace: 'at LoginPage.login (login.ts:45)\nat test (test.ts:12)',
        pipeline: 'main-pipeline',
        branch: 'feature-branch',
        commitHash: 'ghi789',
        timestamp: new Date(),
      };

      const similar = await manager.findSimilarFailures(newFailure, {
        limit: 5,
        minSimilarity: 0.7,
      });

      expect(similar.length).toBeGreaterThan(0);
      expect(similar[0].similarity).toBeGreaterThan(0.7);
      expect(similar[0].resolution).toBeDefined();
    });
  });

  describe('Cost Tracking', () => {
    it('should track AI usage and costs', async () => {
      if (!aiManagerInitialized) {
        console.log('Skipping: AI not enabled');
        return;
      }

      const manager = getAIManager();
      const summary = await manager.getCostSummary();

      expect(summary).toBeDefined();
      expect(summary.totalCost).toBeGreaterThanOrEqual(0);
      expect(summary.totalRequests).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Health Check', () => {
    it('should perform health check on all services', async () => {
      if (!aiManagerInitialized) {
        console.log('Skipping: AI not enabled');
        return;
      }

      const manager = getAIManager();
      const health = await manager.healthCheck();

      expect(health).toBeDefined();
      expect(health.healthy).toBeDefined();
      expect(health.services).toBeDefined();
    });
  });
});

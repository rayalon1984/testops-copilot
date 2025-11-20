/**
 * AI API Routes
 *
 * REST API endpoints for AI features including RCA matching,
 * cost tracking, and health checks.
 */

import { Router, Request, Response } from 'express';
import { getAIManager } from '../../../services/ai';
import { TestFailure } from '../../../services/ai/types';
import { RCAMatchingOptions } from '../../../services/ai/features/rca-matching';
import { CategorizationOptions } from '../../../services/ai/features/categorization';
import { SummarizationOptions } from '../../../services/ai/features/log-summary';

const router = Router();

/**
 * GET /api/ai/health
 * Health check for AI services
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const aiManager = getAIManager();

    if (!aiManager.isEnabled()) {
      return res.json({
        enabled: false,
        message: 'AI features are disabled',
      });
    }

    const health = await aiManager.healthCheck();

    res.json({
      enabled: true,
      healthy: health.healthy,
      services: health.services,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/ai/rca/similar
 * Find similar failures for a given test failure
 */
router.post('/rca/similar', async (req: Request, res: Response) => {
  try {
    const aiManager = getAIManager();

    if (!aiManager.isFeatureEnabled('rcaMatching')) {
      return res.status(403).json({
        error: 'RCA matching is not enabled',
      });
    }

    const failure: TestFailure = req.body.failure;
    const options: RCAMatchingOptions = req.body.options || {};

    if (!failure || !failure.testId || !failure.errorMessage) {
      return res.status(400).json({
        error: 'Invalid failure data. Required: testId, errorMessage',
      });
    }

    const similarFailures = await aiManager.findSimilarFailures(failure, options);

    res.json({
      query: {
        testId: failure.testId,
        testName: failure.testName,
      },
      results: similarFailures.length,
      matches: similarFailures.map(sf => ({
        id: sf.failure.id,
        testName: sf.failure.testName,
        errorMessage: sf.failure.errorMessage,
        similarity: sf.similarity,
        explanation: sf.explanation,
        resolution: sf.resolution,
        resolvedAt: sf.resolvedAt,
        resolvedBy: sf.resolvedBy,
        ticketUrl: sf.ticketUrl,
        category: sf.failure.category,
        timestamp: sf.failure.timestamp,
      })),
    });
  } catch (error) {
    console.error('RCA matching failed:', error);
    res.status(500).json({
      error: 'RCA matching failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/ai/rca/store
 * Store a test failure for future RCA matching
 */
router.post('/rca/store', async (req: Request, res: Response) => {
  try {
    const aiManager = getAIManager();

    if (!aiManager.isFeatureEnabled('rcaMatching')) {
      return res.status(403).json({
        error: 'RCA matching is not enabled',
      });
    }

    const failure: TestFailure = req.body;

    if (!failure || !failure.testId || !failure.errorMessage) {
      return res.status(400).json({
        error: 'Invalid failure data. Required: testId, testName, errorMessage, pipeline, branch, commitHash',
      });
    }

    const id = await aiManager.storeFailure(failure);

    res.status(201).json({
      id,
      message: 'Failure stored successfully',
    });
  } catch (error) {
    console.error('Failed to store failure:', error);
    res.status(500).json({
      error: 'Failed to store failure',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/ai/rca/:id/resolve
 * Mark a failure as resolved
 */
router.put('/rca/:id/resolve', async (req: Request, res: Response) => {
  try {
    const aiManager = getAIManager();

    if (!aiManager.isFeatureEnabled('rcaMatching')) {
      return res.status(403).json({
        error: 'RCA matching is not enabled',
      });
    }

    const { id } = req.params;
    const { resolution, resolvedBy, ticketUrl } = req.body;

    if (!resolution || !resolvedBy) {
      return res.status(400).json({
        error: 'Required fields: resolution, resolvedBy',
      });
    }

    await aiManager.markFailureAsResolved(id, resolution, resolvedBy, ticketUrl);

    res.json({
      message: 'Failure marked as resolved',
      id,
    });
  } catch (error) {
    console.error('Failed to mark failure as resolved:', error);
    res.status(500).json({
      error: 'Failed to mark failure as resolved',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/ai/costs
 * Get AI usage and cost summary
 */
router.get('/costs', async (req: Request, res: Response) => {
  try {
    const aiManager = getAIManager();

    const { startDate, endDate } = req.query;

    let summary;
    if (startDate && endDate) {
      summary = await aiManager.getCostSummary(
        new Date(startDate as string),
        new Date(endDate as string)
      );
    } else {
      summary = await aiManager.getCostSummary();
    }

    res.json(summary);
  } catch (error) {
    console.error('Failed to get cost summary:', error);
    res.status(500).json({
      error: 'Failed to get cost summary',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/ai/stats
 * Get overall AI statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const aiManager = getAIManager();

    const [costSummary, cacheStats, rcaStats] = await Promise.all([
      aiManager.getCostSummary(),
      aiManager.getCacheStats(),
      aiManager.getRCAStats(),
    ]);

    res.json({
      costs: costSummary,
      cache: cacheStats,
      rca: rcaStats,
    });
  } catch (error) {
    console.error('Failed to get stats:', error);
    res.status(500).json({
      error: 'Failed to get stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/ai/categorize
 * Categorize a test failure
 */
router.post('/categorize', async (req: Request, res: Response) => {
  try {
    const aiManager = getAIManager();

    if (!aiManager.isFeatureEnabled('categorization')) {
      return res.status(403).json({
        error: 'Categorization is not enabled',
      });
    }

    const failure: TestFailure = req.body.failure;
    const options: CategorizationOptions = req.body.options || {};

    if (!failure || !failure.testId || !failure.errorMessage) {
      return res.status(400).json({
        error: 'Invalid failure data. Required: testId, errorMessage',
      });
    }

    const categorization = await aiManager.categorizeFailure(failure, options);

    res.json({
      testId: failure.testId,
      testName: failure.testName,
      category: categorization.category,
      confidence: categorization.confidence,
      reasoning: categorization.reasoning,
      suggestedAction: categorization.suggestedAction,
      relatedIssues: categorization.relatedIssues,
    });
  } catch (error) {
    console.error('Categorization failed:', error);
    res.status(500).json({
      error: 'Categorization failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/ai/summarize
 * Summarize test failure logs
 */
router.post('/summarize', async (req: Request, res: Response) => {
  try {
    const aiManager = getAIManager();

    if (!aiManager.isFeatureEnabled('logSummary')) {
      return res.status(403).json({
        error: 'Log summarization is not enabled',
      });
    }

    const { logs, testName, errorMessage, options } = req.body;

    if (!logs || !testName || !errorMessage) {
      return res.status(400).json({
        error: 'Required fields: logs, testName, errorMessage',
      });
    }

    const summary = await aiManager.summarizeLogs(
      logs,
      testName,
      errorMessage,
      options as SummarizationOptions
    );

    res.json({
      testName,
      summary: summary.summary,
      rootCause: summary.rootCause,
      errorLocation: summary.errorLocation,
      keyLogLines: summary.keyLogLines,
      suggestedFix: summary.suggestedFix,
      confidence: summary.confidence,
    });
  } catch (error) {
    console.error('Log summarization failed:', error);
    res.status(500).json({
      error: 'Log summarization failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

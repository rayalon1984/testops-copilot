/**
 * AI Analysis Routes — RCA, categorization, summarization, enrichment, costs, stats.
 *
 * Split from the monolithic ai/index.ts for navigability.
 */

import { Router, Request, Response } from 'express';
import { getAIManager } from '../../services/ai';
import { TestFailure } from '../../services/ai/types';
import { RCAMatchingOptions } from '../../services/ai/features/rca-matching';
import { CategorizationOptions } from '../../services/ai/features/categorization';
import { SummarizationOptions } from '../../services/ai/features/log-summary';
import { EnrichmentInput } from '../../services/ai/features/context-enrichment';
import { logger } from '../../utils/logger';

const router = Router();

// ─── RCA ───

router.post('/rca/similar', async (req: Request, res: Response) => {
  try {
    const aiManager = getAIManager();
    if (!aiManager.isFeatureEnabled('rcaMatching')) {
      return res.status(403).json({ error: 'RCA matching is not enabled' });
    }

    const failure: TestFailure = req.body.failure;
    const options: RCAMatchingOptions = req.body.options || {};

    if (!failure || !failure.testId || !failure.errorMessage) {
      return res.status(400).json({ error: 'Invalid failure data. Required: testId, errorMessage' });
    }

    const matches = await aiManager.findSimilarFailures(failure, options);
    return res.json({
      query: { testId: failure.testId, testName: failure.testName },
      results: matches.length,
      matches: matches.map(sf => ({
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
    logger.error('[AIAnalysis] RCA matching failed:', error);
    return res.status(500).json({ error: 'RCA matching failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/rca/store', async (req: Request, res: Response) => {
  try {
    const aiManager = getAIManager();
    if (!aiManager.isFeatureEnabled('rcaMatching')) {
      return res.status(403).json({ error: 'RCA matching is not enabled' });
    }

    const failure: TestFailure = req.body;
    if (!failure || !failure.testId || !failure.errorMessage) {
      return res.status(400).json({ error: 'Invalid failure data. Required: testId, testName, errorMessage, pipeline, branch, commitHash' });
    }

    const id = await aiManager.storeFailure(failure);
    return res.status(201).json({ id, message: 'Failure stored successfully' });
  } catch (error) {
    logger.error('[AIAnalysis] Failed to store failure:', error);
    return res.status(500).json({ error: 'Failed to store failure', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.put('/rca/:id/resolve', async (req: Request, res: Response) => {
  try {
    const aiManager = getAIManager();
    if (!aiManager.isFeatureEnabled('rcaMatching')) {
      return res.status(403).json({ error: 'RCA matching is not enabled' });
    }

    const { resolution, resolvedBy, ticketUrl } = req.body;
    if (!resolution || !resolvedBy) {
      return res.status(400).json({ error: 'Required fields: resolution, resolvedBy' });
    }

    await aiManager.markFailureAsResolved(req.params.id as string, resolution, resolvedBy, ticketUrl);
    return res.json({ message: 'Failure marked as resolved', id: req.params.id });
  } catch (error) {
    logger.error('[AIAnalysis] Failed to mark failure as resolved:', error);
    return res.status(500).json({ error: 'Failed to mark failure as resolved', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ─── AI Features ───

router.post('/categorize', async (req: Request, res: Response) => {
  try {
    const aiManager = getAIManager();
    if (!aiManager.isFeatureEnabled('categorization')) {
      return res.status(403).json({ error: 'Categorization is not enabled' });
    }

    const failure: TestFailure = req.body.failure;
    const options: CategorizationOptions = req.body.options || {};

    if (!failure || !failure.testId || !failure.errorMessage) {
      return res.status(400).json({ error: 'Invalid failure data. Required: testId, errorMessage' });
    }

    const result = await aiManager.categorizeFailure(failure, options);
    return res.json({
      testId: failure.testId,
      testName: failure.testName,
      category: result.category,
      confidence: result.confidence,
      reasoning: result.reasoning,
      suggestedAction: result.suggestedAction,
      relatedIssues: result.relatedIssues,
    });
  } catch (error) {
    logger.error('[AIAnalysis] Categorization failed:', error);
    return res.status(500).json({ error: 'Categorization failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/summarize', async (req: Request, res: Response) => {
  try {
    const aiManager = getAIManager();
    if (!aiManager.isFeatureEnabled('logSummary')) {
      return res.status(403).json({ error: 'Log summarization is not enabled' });
    }

    const { logs, testName, errorMessage, options } = req.body;
    if (!logs || !testName || !errorMessage) {
      return res.status(400).json({ error: 'Required fields: logs, testName, errorMessage' });
    }

    const summary = await aiManager.summarizeLogs(logs, testName, errorMessage, options as SummarizationOptions);
    return res.json({
      testName,
      summary: summary.summary,
      rootCause: summary.rootCause,
      errorLocation: summary.errorLocation,
      keyLogLines: summary.keyLogLines,
      suggestedFix: summary.suggestedFix,
      confidence: summary.confidence,
    });
  } catch (error) {
    logger.error('[AIAnalysis] Log summarization failed:', error);
    return res.status(500).json({ error: 'Log summarization failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/enrich', async (req: Request, res: Response) => {
  try {
    const aiManager = getAIManager();
    const { failure, repo, sources, maxResultsPerSource } = req.body;

    if (!failure || !failure.testId || !failure.errorMessage) {
      return res.status(400).json({ error: 'Invalid failure data. Required: failure.testId, failure.errorMessage' });
    }

    const input: EnrichmentInput = { failure, repo, sources, maxResultsPerSource };
    const result = await aiManager.enrichFailureContext(input);

    return res.json({
      analysis: result.analysis,
      confidence: result.confidence,
      sourcesQueried: result.sourcesQueried,
      context: {
        jiraIssues: result.context.jiraIssues,
        confluencePages: result.context.confluencePages,
        codeChanges: result.context.codeChanges,
      },
    });
  } catch (error) {
    logger.error('[AIAnalysis] Context enrichment failed:', error);
    return res.status(500).json({ error: 'Context enrichment failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ─── Costs & Stats ───

router.get('/costs', async (req: Request, res: Response) => {
  try {
    const aiManager = getAIManager();
    const { startDate, endDate } = req.query;

    const summary = (startDate && endDate)
      ? await aiManager.getCostSummary(new Date(startDate as string), new Date(endDate as string))
      : await aiManager.getCostSummary();

    return res.json(summary);
  } catch (error) {
    logger.error('[AIAnalysis] Failed to get cost summary:', error);
    return res.status(500).json({ error: 'Failed to get cost summary', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const aiManager = getAIManager();

    const [costSummary, cacheStats, rcaStats] = await Promise.all([
      aiManager.getCostSummary(),
      aiManager.getCacheStats(),
      aiManager.getRCAStats(),
    ]);

    return res.json({ costs: costSummary, cache: cacheStats, rca: rcaStats });
  } catch (error) {
    logger.error('[AIAnalysis] Failed to get stats:', error);
    return res.status(500).json({ error: 'Failed to get stats', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;

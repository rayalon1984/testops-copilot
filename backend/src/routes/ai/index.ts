/**
 * AI API Routes
 *
 * REST API endpoints for AI features including RCA matching,
 * cost tracking, and health checks.
 */

import { Router, Request, Response, IRouter } from 'express';
import { getAIManager } from '../../services/ai';
import { authenticate } from '../../middleware/auth';
import { TestFailure } from '../../services/ai/types';
import { RCAMatchingOptions } from '../../services/ai/features/rca-matching';
import { CategorizationOptions } from '../../services/ai/features/categorization';
import { SummarizationOptions } from '../../services/ai/features/log-summary';
import { EnrichmentInput } from '../../services/ai/features/context-enrichment';
import { handleChatStream } from '../../services/ai/AIChatService';
import * as chatSession from '../../services/ai/ChatSessionService';

const router: IRouter = Router();

// All AI routes require authentication
router.use(authenticate);

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

    return res.json({
      enabled: true,
      healthy: health.healthy,
      services: health.services,
    });
  } catch (error) {
    return res.status(500).json({
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

    return res.json({
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
    return res.status(500).json({
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

    return res.status(201).json({
      id,
      message: 'Failure stored successfully',
    });
  } catch (error) {
    console.error('Failed to store failure:', error);
    return res.status(500).json({
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

    const id = req.params.id as string;
    const { resolution, resolvedBy, ticketUrl } = req.body;

    if (!resolution || !resolvedBy) {
      return res.status(400).json({
        error: 'Required fields: resolution, resolvedBy',
      });
    }

    await aiManager.markFailureAsResolved(id, resolution, resolvedBy, ticketUrl);

    return res.json({
      message: 'Failure marked as resolved',
      id,
    });
  } catch (error) {
    console.error('Failed to mark failure as resolved:', error);
    return res.status(500).json({
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

    return res.json(summary);
  } catch (error) {
    console.error('Failed to get cost summary:', error);
    return res.status(500).json({
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

    return res.json({
      costs: costSummary,
      cache: cacheStats,
      rca: rcaStats,
    });
  } catch (error) {
    console.error('Failed to get stats:', error);
    return res.status(500).json({
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

    return res.json({
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
    return res.status(500).json({
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
    console.error('Log summarization failed:', error);
    return res.status(500).json({
      error: 'Log summarization failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/ai/enrich
 * Enrich a test failure with cross-platform context from Jira, Confluence, and GitHub.
 * Returns related Jira issues, relevant Confluence docs, code changes, and AI analysis.
 */
router.post('/enrich', async (req: Request, res: Response) => {
  try {
    const aiManager = getAIManager();

    const { failure, repo, sources, maxResultsPerSource } = req.body;

    if (!failure || !failure.testId || !failure.errorMessage) {
      return res.status(400).json({
        error: 'Invalid failure data. Required: failure.testId, failure.errorMessage',
      });
    }

    const input: EnrichmentInput = {
      failure,
      repo,
      sources,
      maxResultsPerSource,
    };

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
    console.error('Context enrichment failed:', error);
    return res.status(500).json({
      error: 'Context enrichment failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/ai/chat
 * Agentic chat endpoint with SSE streaming.
 * Executes a ReAct loop: Reason → Tool Call → Observe → Answer.
 */
router.post('/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, sessionId, history } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message is required and must be a string' });
      return;
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx proxy
    res.flushHeaders();

    // Extract user info from auth middleware
    const user = (req as any).user || {};

    await handleChatStream(
      {
        message,
        sessionId,
        userId: user.id || 'anonymous',
        userRole: user.role || 'viewer',
        history: history || [],
      },
      res
    );

    if (!res.writableEnded) {
      res.end();
    }
  } catch (error) {
    console.error('Chat endpoint failed:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Chat failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', data: 'Internal server error' })}\n\n`);
      res.end();
    }
  }
});

// ─── Chat Session CRUD ───

/**
 * GET /api/ai/sessions
 * List all sessions for the authenticated user.
 */
router.get('/sessions', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user || {};
    const sessions = await chatSession.getUserSessions(user.id);
    res.json({ data: sessions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

/**
 * GET /api/ai/sessions/:id
 * Get a session with all messages.
 */
router.get('/sessions/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user || {};
    const session = await chatSession.getSessionWithMessages(req.params.id as string, user.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ data: session });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get session' });
  }
});

/**
 * POST /api/ai/sessions
 * Create a new chat session.
 */
router.post('/sessions', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user || {};
    const session = await chatSession.createSession({
      userId: user.id,
      title: req.body.title,
    });
    res.status(201).json({ data: session });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create session' });
  }
});

/**
 * DELETE /api/ai/sessions/:id
 * Delete a session and all messages.
 */
router.delete('/sessions/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user || {};
    await chatSession.deleteSession(req.params.id as string, user.id);
    res.json({ message: 'Session deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

export default router;

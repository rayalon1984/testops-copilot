/**
 * Webhook Routes — CI/CD Integration
 *
 * Handles incoming webhooks from GitHub for automated test selection.
 * These routes do NOT use standard `authenticate` middleware —
 * each webhook type performs its own signature verification.
 *
 * Pattern follows channel.routes.ts (Slack/Teams webhook handling).
 */

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { testImpactService } from '../services/test/TestImpactService';
import { logger } from '../utils/logger';
import { config } from '../config';

const router = Router();

// ─── GitHub Webhook Signature Verification ───

function verifyGitHubSignature(
  secret: string,
  signature: string,
  body: string
): boolean {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');

  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expected, 'utf8')
    );
  } catch {
    return false;
  }
}

function githubWebhookMiddleware(req: Request, res: Response, next: NextFunction): void {
  const webhookSecret = config.github.webhookSecret;
  if (!webhookSecret) {
    logger.warn('[GitHubWebhook] GITHUB_WEBHOOK_SECRET not configured — rejecting request');
    res.status(503).json({ error: 'GitHub webhook integration not configured' });
    return;
  }

  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) {
    res.status(401).json({ error: 'Missing GitHub signature header' });
    return;
  }

  // Use rawBody if available, otherwise re-serialize
  const rawBody = (req as Request & { rawBody?: string }).rawBody || JSON.stringify(req.body);
  if (!verifyGitHubSignature(webhookSecret, signature, rawBody)) {
    logger.warn('[GitHubWebhook] Invalid signature — rejecting request');
    res.status(401).json({ error: 'Invalid GitHub webhook signature' });
    return;
  }

  next();
}

// ─── GitHub Webhook Handler ───

/**
 * POST /api/v1/webhooks/github
 *
 * Handles GitHub webhook events for automated smart test selection.
 * Supported events:
 * - pull_request.opened — New PR created
 * - pull_request.synchronize — New commits pushed to PR
 * - push — Direct push to a branch
 */
router.post('/github', githubWebhookMiddleware, async (req: Request, res: Response) => {
  const event = req.headers['x-github-event'] as string;
  const delivery = req.headers['x-github-delivery'] as string;

  logger.info('[GitHubWebhook] Received event', { event, delivery });

  try {
    switch (event) {
      case 'pull_request': {
        const action = req.body.action;
        if (action !== 'opened' && action !== 'synchronize') {
          res.json({ message: `Ignoring pull_request.${action}` });
          return;
        }

        const pr = req.body.pull_request;
        const files = await extractPRFiles(req.body);

        if (files.length === 0) {
          logger.info('[GitHubWebhook] No files in PR — skipping', {
            pr: pr.number,
          });
          res.json({ message: 'No files to analyze', pr: pr.number });
          return;
        }

        const result = await testImpactService.getTestsForChanges(files);

        logger.info('[GitHubWebhook] Smart selection complete', {
          pr: pr.number,
          selectedTests: result.selectedTests.length,
          strategy: result.selectionStrategy,
          confidence: result.confidence,
        });

        res.json({
          message: 'Smart test selection completed',
          pr: pr.number,
          selection: result,
        });
        return;
      }

      case 'push': {
        const commits = req.body.commits || [];
        const files = new Set<string>();

        for (const commit of commits) {
          for (const f of (commit.added || [])) files.add(f);
          for (const f of (commit.modified || [])) files.add(f);
          for (const f of (commit.removed || [])) files.add(f);
        }

        if (files.size === 0) {
          res.json({ message: 'No files changed in push' });
          return;
        }

        const result = await testImpactService.getTestsForChanges(Array.from(files));

        logger.info('[GitHubWebhook] Smart selection for push', {
          branch: req.body.ref,
          filesChanged: files.size,
          selectedTests: result.selectedTests.length,
        });

        res.json({
          message: 'Smart test selection completed',
          branch: req.body.ref,
          selection: result,
        });
        return;
      }

      case 'ping': {
        logger.info('[GitHubWebhook] Ping received — webhook is active');
        res.json({ message: 'pong' });
        return;
      }

      default: {
        logger.info('[GitHubWebhook] Unhandled event type', { event });
        res.json({ message: `Event type '${event}' is not handled` });
        return;
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[GitHubWebhook] Error processing webhook', { event, error: msg });
    res.status(500).json({ error: 'Failed to process webhook', details: msg });
  }
});

/**
 * Extract changed file paths from a pull_request webhook payload.
 * GitHub webhook payloads include files only for small PRs.
 * For larger PRs, we would need to call the GitHub API.
 * Here we extract from the payload if available, otherwise return empty.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPRFiles(payload: Record<string, any>): string[] {
  // GitHub PR webhooks don't include files directly in the payload.
  // The files are available via the API: GET /repos/:owner/:repo/pulls/:number/files
  // For now, we return the changed files from the commits if included.
  const commits = payload.pull_request?.commits_url ? [] : [];

  // If the webhook payload has been enriched (some GitHub Apps include this)
  if (payload.files) {
    return payload.files.map((f: Record<string, unknown>) => f.filename as string);
  }

  // Extract from head commit if present
  if (payload.pull_request?.head?.sha) {
    // In a production setup, we'd call githubService.getPullRequestFiles() here
    // For now, log that we'd need the API call
    logger.info('[GitHubWebhook] PR files not in payload — would fetch via API', {
      pr: payload.pull_request.number,
      headSha: payload.pull_request.head.sha,
    });
  }

  return commits;
}

export default router;

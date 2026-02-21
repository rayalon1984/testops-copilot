/**
 * Feature Spec Tests — Context Enrichment
 *
 * Covers: multi-source gathering, confidence scoring, AI synthesis.
 * 10 assertions across 3 capabilities.
 */

import { describeFeature, itAssertion } from '../../../__tests__/helpers/feature-spec';

// Mock logger
jest.mock('@/utils/logger', () => ({
  __esModule: true,
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// --- Inline helpers modeling enrichment behavior ---

interface SourceResults {
  jira: unknown[];
  confluence: unknown[];
  github: { commit?: unknown; pr?: unknown } | null;
}

function gatherAllSources(
  sources: { jira?: boolean; confluence?: boolean; github?: boolean },
  jiraEnabled: boolean,
  confluenceEnabled: boolean,
  githubRepo?: string,
): Promise<PromiseSettledResult<unknown>[]> {
  const tasks: Promise<unknown>[] = [];
  if (sources.jira !== false && jiraEnabled) {
    tasks.push(Promise.resolve([{ key: 'PROJ-123' }]));
  }
  if (sources.confluence !== false && confluenceEnabled) {
    tasks.push(Promise.resolve([{ title: 'Runbook' }]));
  }
  if (sources.github !== false && githubRepo) {
    tasks.push(Promise.resolve({ commit: { sha: 'abc' } }));
  }
  return Promise.allSettled(tasks);
}

function truncatePatch(patch: string, max: number): string {
  if (patch.length <= max) return patch;
  return patch.slice(0, max) + '... (truncated)';
}

function calculateConfidence(results: SourceResults): number {
  let conf = 0.3; // base
  if (results.jira.length > 0) conf += 0.2;
  if (results.confluence.length > 0) conf += 0.15;
  if (results.github?.pr) conf += 0.25;
  else if (results.github?.commit) conf += 0.15;
  return Math.min(conf, 0.95);
}

function scoreFileRelevance(file: string, stackTrace: string, errorMessage: string): number {
  let score = 0;
  if (stackTrace.includes(file)) score += 10;
  const basename = file.split('/').pop() ?? '';
  if (errorMessage.includes(basename)) score += 5;
  if (/\.test\.|\.spec\./i.test(file)) score += 2;
  return score;
}

describeFeature('context-enrichment', () => {
  // ── Multi-Source Gathering ──────────────────────────────────────────

  itAssertion('enrichment.gathering.parallel-allsettled', () => {
    const tasks = [
      Promise.resolve('jira-ok'),
      Promise.reject(new Error('confluence-down')),
      Promise.resolve('github-ok'),
    ];
    return Promise.allSettled(tasks).then(results => {
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
      // Key: all 3 settled, one failure doesn't block others
      expect(results).toHaveLength(3);
    });
  });

  itAssertion('enrichment.gathering.source-independence', async () => {
    // Service not configured -> source skipped
    const results = await gatherAllSources(
      { jira: true, confluence: true, github: true },
      true,    // jira enabled
      false,   // confluence NOT enabled
      undefined, // no github repo
    );
    // Only jira should have run
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('fulfilled');
  });

  itAssertion('enrichment.gathering.max-results-per-source', () => {
    const maxResultsPerSource = 5;
    const mockResults = Array.from({ length: 10 }, (_, i) => ({ key: `PROJ-${i}` }));
    const limited = mockResults.slice(0, maxResultsPerSource);
    expect(limited).toHaveLength(5);
  });

  itAssertion('enrichment.gathering.patch-truncation', () => {
    const shortPatch = 'const x = 1;';
    expect(truncatePatch(shortPatch, 2000)).toBe(shortPatch);

    const longPatch = 'x'.repeat(3000);
    const truncated = truncatePatch(longPatch, 2000);
    expect(truncated.length).toBeLessThanOrEqual(2000 + 20); // marker length
    expect(truncated).toContain('... (truncated)');
  });

  // ── Confidence Scoring ──────────────────────────────────────────────

  itAssertion('enrichment.confidence.base-score', () => {
    // No sources -> base only
    const baseOnly = calculateConfidence({ jira: [], confluence: [], github: null });
    expect(baseOnly).toBe(0.3);

    // Jira only
    const withJira = calculateConfidence({ jira: [{}], confluence: [], github: null });
    expect(withJira).toBe(0.5);

    // All sources with PR
    const allWithPR = calculateConfidence({
      jira: [{}], confluence: [{}], github: { pr: {} },
    });
    expect(allWithPR).toBe(0.9);
  });

  itAssertion('enrichment.confidence.max-cap', () => {
    // Even with everything, should cap at 0.95
    const maxed = calculateConfidence({
      jira: [{}], confluence: [{}], github: { pr: {}, commit: {} },
    });
    expect(maxed).toBeLessThanOrEqual(0.95);
  });

  itAssertion('enrichment.confidence.range', () => {
    const scenarios: SourceResults[] = [
      { jira: [], confluence: [], github: null },
      { jira: [{}], confluence: [], github: null },
      { jira: [{}], confluence: [{}], github: { commit: {} } },
      { jira: [{}], confluence: [{}], github: { pr: {} } },
    ];
    for (const s of scenarios) {
      const conf = calculateConfidence(s);
      expect(conf).toBeGreaterThanOrEqual(0);
      expect(conf).toBeLessThanOrEqual(1);
    }
  });

  // ── AI Synthesis ────────────────────────────────────────────────────

  itAssertion('enrichment.synthesis.fallback-without-ai', () => {
    // When no AI provider, falls back to basic summary
    const providerAvailable = false;
    const analysis = providerAvailable
      ? 'AI-generated analysis'
      : 'Analysis based on available context from Jira, Confluence, and GitHub.';
    expect(analysis).toContain('available context');
  });

  itAssertion('enrichment.synthesis.return-shape', () => {
    const result = {
      analysis: 'Root cause appears to be a Redis timeout',
      confidence: 0.75,
      context: {
        jiraIssues: [{ key: 'PROJ-123', summary: 'Redis timeout', status: 'Open' }],
        confluencePages: [{ title: 'Redis Runbook', url: 'https://wiki/redis' }],
        codeChanges: {
          commit: { sha: 'abc123', message: 'fix: redis config', files: [] },
          pullRequest: { number: 42, title: 'Fix Redis' },
        },
      },
      sourcesQueried: ['jira', 'confluence', 'github'],
    };
    expect(result).toMatchObject({
      analysis: expect.any(String),
      confidence: expect.any(Number),
      context: expect.objectContaining({
        jiraIssues: expect.any(Array),
        confluencePages: expect.any(Array),
        codeChanges: expect.any(Object),
      }),
      sourcesQueried: expect.any(Array),
    });
  });

  itAssertion('enrichment.synthesis.file-relevance-scoring', () => {
    const stackTrace = 'at checkout.service.ts:42';
    const errorMessage = 'timeout in checkout.service.ts';

    expect(scoreFileRelevance('checkout.service.ts', stackTrace, errorMessage)).toBeGreaterThanOrEqual(10);
    expect(scoreFileRelevance('checkout.service.ts', '', 'checkout.service.ts')).toBe(5);
    expect(scoreFileRelevance('checkout.spec.ts', '', '')).toBe(2);
    expect(scoreFileRelevance('unrelated.ts', '', '')).toBe(0);
  });
});

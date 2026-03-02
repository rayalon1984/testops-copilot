import axios, { AxiosInstance, AxiosError } from 'axios';
import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';
import { config } from '@/config';
import { validateUrlForSSRF } from '@/utils/ssrf-validator';
import { withResilience, circuitBreakers } from '@/lib/resilience';

// ─── Types ───────────────────────────────────────────────────────────

export interface XrayTestCase {
  key: string;
  summary: string;
  status: string;
  lastExecution: string | null;
}

export interface XrayTestPlan {
  key: string;
  summary: string;
  testCount: number;
  passRate: number;
  coveragePercentage: number;
  coveredCount: number;
  lastUpdated: string | null;
}

export interface XrayTestPlanDetail extends XrayTestPlan {
  testCases: XrayTestCase[];
}

export interface XrayTestCaseHistory {
  testCaseKey: string;
  summary: string;
  status: string;
  executionHistory: Array<{
    date: string;
    status: string;
    executionKey: string;
  }>;
  linkedDefects: Array<{
    key: string;
    summary: string;
    status: string;
  }>;
}

export interface XraySyncResult {
  syncId: string;
  status: string;
  xrayExecutionId: string | null;
  resultCount: number;
}

// ─── Status Mapping ──────────────────────────────────────────────────

const STATUS_MAP: Record<string, string> = {
  PASSED: 'PASS',
  FAILED: 'FAIL',
  SKIPPED: 'TODO',
  FLAKY: 'FAIL',
  ERROR: 'FAIL',
  PENDING: 'TODO',
  RUNNING: 'TODO',
};

// ─── Resilience Config ───────────────────────────────────────────────

const XRAY_RESILIENCE = {
  circuitBreaker: circuitBreakers.xray,
  retry: { maxRetries: 2, baseDelayMs: 1_000 },
  timeoutMs: 15_000,
  label: 'xray',
};

// ─── Service ─────────────────────────────────────────────────────────

export class XrayService {
  private client: AxiosInstance | null = null;
  private enabled: boolean = false;
  private token: string | null = null;
  private tokenExpiresAt: number = 0;
  private baseUrl: string = '';
  private projectKey: string = '';

  constructor() {
    if (!config.xray) {
      logger.warn('Xray integration is not configured. Xray features will be disabled.');
      this.enabled = false;
      return;
    }

    try {
      validateUrlForSSRF(config.xray.cloudUrl);

      this.baseUrl = config.xray.cloudUrl;
      this.projectKey = config.xray.projectKey;

      this.client = axios.create({
        baseURL: `${config.xray.cloudUrl}/api/v2`,
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 15_000,
      });

      this.enabled = true;
      logger.info('Xray integration initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Xray client:', error);
      this.enabled = false;
    }
  }

  // ─── Guards ──────────────────────────────────────────────────────

  private checkEnabled(): void {
    if (!this.enabled || !this.client) {
      throw new Error('Xray integration is not enabled or configured');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // ─── Authentication ──────────────────────────────────────────────

  /**
   * Exchange client_id + client_secret for a JWT token.
   * Caches the token and refreshes on 401.
   */
  async authenticate(): Promise<string> {
    this.checkEnabled();

    // Return cached token if still valid (5min buffer)
    if (this.token && Date.now() < this.tokenExpiresAt - 300_000) {
      return this.token;
    }

    try {
      const response = await withResilience(
        () => this.client!.post('/authenticate', {
          client_id: config.xray!.clientId,
          client_secret: config.xray!.clientSecret,
        }),
        XRAY_RESILIENCE,
      );

      // Xray returns the JWT token as a plain string (quoted)
      const jwt = typeof response.data === 'string'
        ? response.data.replace(/^"|"$/g, '')
        : response.data;

      this.token = jwt;
      // Xray tokens are valid for ~1 hour; refresh at 55 min
      this.tokenExpiresAt = Date.now() + 55 * 60 * 1000;

      logger.info('Xray authentication successful');
      return jwt;
    } catch (error) {
      this.token = null;
      this.tokenExpiresAt = 0;
      const message = this.sanitizeError(error);
      logger.error('Xray authentication failed:', message);
      throw new Error(`Xray authentication failed: ${message}`);
    }
  }

  /**
   * Get an authorized axios instance with current JWT.
   * Refreshes token on 401.
   */
  private async getAuthorizedClient(): Promise<AxiosInstance> {
    const token = await this.authenticate();
    const client = axios.create({
      baseURL: `${this.baseUrl}/api/v2`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      timeout: 15_000,
    });
    return client;
  }

  // ─── Connection Validation ───────────────────────────────────────

  /**
   * Validate Xray credentials by attempting authentication.
   */
  async validateConnection(): Promise<boolean> {
    this.checkEnabled();

    try {
      await this.authenticate();
      logger.info('Xray connection validated successfully');
      return true;
    } catch {
      return false;
    }
  }

  // ─── Test Case Search ────────────────────────────────────────────

  /**
   * Search Xray test cases using GraphQL API.
   * Caps results at 25 regardless of user request.
   */
  async getTestCases(query: string, limit: number = 10): Promise<XrayTestCase[]> {
    this.checkEnabled();

    const cappedLimit = Math.min(limit, 25);
    const escapedQuery = this.escapeJql(query);

    try {
      const client = await this.getAuthorizedClient();

      const response = await withResilience(
        () => client.post('/graphql', {
          query: `
            {
              getTests(
                jql: "project = '${this.projectKey}' AND summary ~ '${escapedQuery}'"
                limit: ${cappedLimit}
              ) {
                total
                results {
                  issueId
                  testType { name }
                  status { name }
                  lastModified
                  jira(fields: ["key", "summary"])
                }
              }
            }
          `,
        }),
        XRAY_RESILIENCE,
      );

      const results = response.data?.data?.getTests?.results || [];
      return results.map((r: Record<string, unknown>) => ({
        key: (r.jira as Record<string, unknown>)?.key || r.issueId,
        summary: (r.jira as Record<string, unknown>)?.summary || 'Unknown',
        status: (r.status as Record<string, unknown>)?.name || 'UNKNOWN',
        lastExecution: (r.lastModified as string) || null,
      }));
    } catch (error) {
      const message = this.sanitizeError(error);
      logger.error('Failed to search Xray test cases:', message);
      throw new Error('Failed to search Xray test cases');
    }
  }

  /**
   * List Xray test plans for the configured project (paginated with coverage).
   */
  async getTestPlans(limit: number = 10, start: number = 0): Promise<{ total: number; plans: XrayTestPlan[] }> {
    this.checkEnabled();
    const cappedLimit = Math.min(limit, 25);

    try {
      const client = await this.getAuthorizedClient();

      const response = await withResilience(
        () => client.post('/graphql', {
          query: `
            {
              getTestPlans(
                jql: "project = '${this.projectKey}'"
                limit: ${cappedLimit}
                start: ${start}
              ) {
                total
                results {
                  issueId
                  jira(fields: ["key", "summary"])
                  tests(limit: 100) { total }
                  testCoverage { covered total percentage }
                  lastModified
                }
              }
            }
          `,
        }),
        XRAY_RESILIENCE,
      );

      const data = response.data?.data?.getTestPlans || {};
      const results = data.results || [];
      return {
        total: data.total || results.length,
        plans: results.map((r: Record<string, unknown>) => {
          const coverage = r.testCoverage as Record<string, number> | undefined;
          return {
            key: (r.jira as Record<string, unknown>)?.key || r.issueId,
            summary: (r.jira as Record<string, unknown>)?.summary || 'Unknown',
            testCount: coverage?.total || (r.tests as Record<string, unknown>)?.total || 0,
            passRate: 0,
            coveragePercentage: coverage?.percentage || 0,
            coveredCount: coverage?.covered || 0,
            lastUpdated: (r.lastModified as string) || null,
          };
        }),
      };
    } catch (error) {
      const message = this.sanitizeError(error);
      logger.error('Failed to get Xray test plans:', message);
      throw new Error('Failed to get Xray test plans');
    }
  }

  /**
   * Get a single test plan with its test cases.
   */
  async getTestPlan(planId: string): Promise<XrayTestPlanDetail> {
    this.checkEnabled();

    try {
      const client = await this.getAuthorizedClient();

      const response = await withResilience(
        () => client.post('/graphql', {
          query: `
            {
              getTestPlan(issueId: "${this.escapeJql(planId)}") {
                issueId
                jira(fields: ["key", "summary"])
                testCoverage { covered total percentage }
                lastModified
                tests(limit: 100) {
                  total
                  results {
                    issueId
                    testType { name }
                    status { name }
                    lastModified
                    jira(fields: ["key", "summary"])
                  }
                }
              }
            }
          `,
        }),
        XRAY_RESILIENCE,
      );

      const plan = response.data?.data?.getTestPlan;
      if (!plan) throw new Error('Test plan not found');

      const coverage = plan.testCoverage as Record<string, number> | undefined;
      const testResults = plan.tests?.results || [];

      return {
        key: ((plan.jira as Record<string, unknown>)?.key as string) || plan.issueId,
        summary: ((plan.jira as Record<string, unknown>)?.summary as string) || 'Unknown',
        testCount: coverage?.total || testResults.length,
        passRate: 0,
        coveragePercentage: coverage?.percentage || 0,
        coveredCount: coverage?.covered || 0,
        lastUpdated: (plan.lastModified as string) || null,
        testCases: testResults.map((r: Record<string, unknown>) => ({
          key: ((r.jira as Record<string, unknown>)?.key as string) || r.issueId,
          summary: ((r.jira as Record<string, unknown>)?.summary as string) || 'Unknown',
          status: ((r.status as Record<string, unknown>)?.name as string) || 'UNKNOWN',
          lastExecution: (r.lastModified as string) || null,
        })),
      };
    } catch (error) {
      const message = this.sanitizeError(error);
      logger.error('Failed to get Xray test plan:', message);
      throw new Error('Failed to get Xray test plan');
    }
  }

  /**
   * Get execution history for a specific test case (for AI enrichment).
   */
  async getTestCaseHistory(testCaseKey: string): Promise<XrayTestCaseHistory> {
    this.checkEnabled();

    try {
      const client = await this.getAuthorizedClient();
      const escapedKey = this.escapeJql(testCaseKey);

      const response = await withResilience(
        () => client.post('/graphql', {
          query: `
            {
              getTests(
                jql: "key = '${escapedKey}'"
                limit: 1
              ) {
                results {
                  issueId
                  testType { name }
                  status { name }
                  jira(fields: ["key", "summary"])
                  testRuns(limit: 5) {
                    results {
                      status { name }
                      startedOn
                      testExecIssue { jira(fields: ["key"]) }
                    }
                  }
                  preconditions(limit: 10) {
                    results {
                      jira(fields: ["key", "summary", "status"])
                    }
                  }
                }
              }
            }
          `,
        }),
        XRAY_RESILIENCE,
      );

      const testCase = response.data?.data?.getTests?.results?.[0];
      if (!testCase) throw new Error('Test case not found');

      const runs = testCase.testRuns?.results || [];
      const defects = testCase.preconditions?.results || [];

      return {
        testCaseKey: (testCase.jira as Record<string, unknown>)?.key as string || testCaseKey,
        summary: (testCase.jira as Record<string, unknown>)?.summary as string || 'Unknown',
        status: (testCase.status as Record<string, unknown>)?.name as string || 'UNKNOWN',
        executionHistory: runs.map((run: Record<string, unknown>) => ({
          date: (run.startedOn as string) || new Date().toISOString(),
          status: ((run.status as Record<string, unknown>)?.name as string) || 'UNKNOWN',
          executionKey: ((run.testExecIssue as Record<string, Record<string, unknown>>)?.jira?.key as string) || 'N/A',
        })),
        linkedDefects: defects.map((d: Record<string, unknown>) => ({
          key: ((d.jira as Record<string, unknown>)?.key as string) || 'N/A',
          summary: ((d.jira as Record<string, unknown>)?.summary as string) || 'Unknown',
          status: ((d.jira as Record<string, unknown>)?.status as string) || 'Unknown',
        })),
      };
    } catch (error) {
      const message = this.sanitizeError(error);
      logger.error('Failed to get Xray test case history:', message);
      throw new Error('Failed to get Xray test case history');
    }
  }

  // ─── Sync Test Run ───────────────────────────────────────────────

  /**
   * Sync a Copilot test run to Xray as a Test Execution.
   * Atomic: creates XraySync record only on full success.
   * Idempotent: re-syncing updates the existing XraySync record.
   */
  async syncTestRun(testRunId: string, trigger: 'MANUAL' | 'AUTO' = 'MANUAL'): Promise<XraySyncResult> {
    this.checkEnabled();

    // 1. Fetch test run + results
    const testRun = await prisma.testRun.findUnique({
      where: { id: testRunId },
      include: { results: true },
    });

    if (!testRun) {
      throw new Error('Test run not found');
    }

    // 2. Check for existing sync (idempotent)
    const existingSync = await prisma.xraySync.findFirst({
      where: { testRunId },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Create or update sync record as SYNCING
    const syncRecord = existingSync
      ? await prisma.xraySync.update({
          where: { id: existingSync.id },
          data: { status: 'SYNCING', errorMessage: null },
        })
      : await prisma.xraySync.create({
          data: {
            testRunId,
            projectKey: this.projectKey,
            status: 'SYNCING',
            trigger,
          },
        });

    try {
      const client = await this.getAuthorizedClient();

      // 4. Build Xray execution payload
      const tests = testRun.results.map((result) => {
        const mapped: Record<string, unknown> = {
          status: STATUS_MAP[result.status] || 'TODO',
          comment: result.error || undefined,
          ...(result.duration != null && { actualDuration: result.duration }),
        };

        // Map to Xray test case if externalTestCaseId is set
        if (result.externalTestCaseId) {
          mapped.testKey = result.externalTestCaseId;
        }

        return mapped;
      });

      // 5. Push to Xray
      const response = await withResilience(
        () => client.post('/import/execution', {
          testExecutionKey: existingSync?.xrayExecutionId || undefined,
          info: {
            project: this.projectKey,
            summary: `TestOps Sync: ${testRun.name}`,
            description: `Synced from TestOps Copilot (run: ${testRunId})`,
          },
          tests,
        }),
        XRAY_RESILIENCE,
      );

      const xrayExecutionId = response.data?.testExecIssue?.key || response.data?.key || null;

      // 6. Mark as SYNCED
      await prisma.xraySync.update({
        where: { id: syncRecord.id },
        data: {
          status: 'SYNCED',
          xrayExecutionId,
          resultCount: tests.length,
          syncedAt: new Date(),
        },
      });

      logger.info(`Synced test run ${testRunId} to Xray: ${xrayExecutionId} (${tests.length} results)`);

      return {
        syncId: syncRecord.id,
        status: 'SYNCED',
        xrayExecutionId,
        resultCount: tests.length,
      };
    } catch (error) {
      // Rollback: mark as FAILED
      const message = this.sanitizeError(error);
      await prisma.xraySync.update({
        where: { id: syncRecord.id },
        data: {
          status: 'FAILED',
          errorMessage: message,
        },
      });

      logger.error(`Failed to sync test run ${testRunId} to Xray:`, message);
      throw new Error('Failed to sync test results to Xray');
    }
  }

  // ─── Sync History ────────────────────────────────────────────────

  /**
   * Get sync history for all test runs.
   */
  async getSyncHistory(limit: number = 20) {
    return prisma.xraySync.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get sync status for a specific sync record.
   */
  async getSyncStatus(syncId: string) {
    const sync = await prisma.xraySync.findUnique({
      where: { id: syncId },
    });

    if (!sync) {
      throw new Error('Sync record not found');
    }

    return sync;
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  /**
   * Escape special characters in JQL queries to prevent injection.
   */
  private escapeJql(input: string): string {
    // Escape JQL special characters: \ " ' ( ) [ ] { } + - & | ! ~ * ? : ^
    return input.replace(/([\\/"'()[\]{}+\-&|!~*?:^])/g, '\\$1');
  }

  /**
   * Sanitize error messages to prevent leaking secrets (client_secret, JWT tokens).
   */
  private sanitizeError(error: unknown): string {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      if (status === 401 || status === 403) {
        return `Authentication failed (HTTP ${status})`;
      }
      if (status === 429) {
        return 'Rate limited by Xray API (HTTP 429)';
      }
      if (status && status >= 500) {
        return `Xray server error (HTTP ${status})`;
      }
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return `Cannot reach Xray API: ${error.code}`;
      }
      return `Xray API error (HTTP ${status || 'unknown'})`;
    }

    if (error instanceof Error) {
      // Strip any potential secrets from error messages
      return error.message
        .replace(/client_secret[=:]\s*\S+/gi, 'client_secret=***')
        .replace(/Bearer\s+\S+/gi, 'Bearer ***');
    }

    return 'Unknown error';
  }
}

// ─── Singleton Export ────────────────────────────────────────────────

export const xrayService = new XrayService();

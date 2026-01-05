import axios, { AxiosInstance } from 'axios';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import { config } from '@/config';

const prisma = new PrismaClient();

// TestRail API Types
export interface TestRailConfig {
  baseUrl: string;
  username: string;
  apiKey: string;
  projectId?: number;
}

export interface TestRailRun {
  id: number;
  name: string;
  description?: string;
  suite_id: number;
  milestone_id?: number;
  assignedto_id?: number;
  include_all?: boolean;
  case_ids?: number[];
}

export interface TestRailResult {
  test_id: number;
  status_id: number;
  comment?: string;
  elapsed?: string;
  defects?: string;
  version?: string;
}

export interface CreateTestRunDTO {
  name: string;
  description?: string;
  suiteId: number;
  milestoneId?: number;
  assignedToId?: number;
  includeAll?: boolean;
  caseIds?: number[];
  testRunId?: string; // Our internal test run ID
}

export interface AddTestResultDTO {
  testId: number;
  statusId: number;
  comment?: string;
  elapsed?: string;
  defects?: string;
  version?: string;
}

// TestRail Status IDs (standard)
export enum TestRailStatus {
  PASSED = 1,
  BLOCKED = 2,
  UNTESTED = 3,
  RETEST = 4,
  FAILED = 5,
}

export class TestRailService {
  private client: AxiosInstance | null = null;
  private projectId: number = 0;
  private enabled: boolean = false;

  constructor() {
    if (!config.testrail) {
      logger.warn('TestRail integration is not configured. TestRail features will be disabled.');
      this.enabled = false;
      return;
    }

    try {
      const auth = Buffer.from(`${config.testrail.username}:${config.testrail.apiKey}`).toString('base64');

      this.client = axios.create({
        baseURL: `${config.testrail.baseUrl}/index.php?/api/v2`,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      this.projectId = config.testrail.projectId || 0;
      this.enabled = true;
      logger.info('TestRail integration initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize TestRail client:', error);
      this.enabled = false;
    }
  }

  private checkEnabled() {
    if (!this.enabled || !this.client) {
      throw new Error('TestRail integration is not enabled or configured');
    }
  }

  /**
   * Validate TestRail connection
   */
  async validateConnection(): Promise<boolean> {
    this.checkEnabled();

    try {
      const response = await this.client!.get('/get_projects');
      logger.info('TestRail connection validated successfully');
      return response.status === 200;
    } catch (error) {
      logger.error('TestRail connection validation failed:', error);
      throw new Error('Failed to connect to TestRail');
    }
  }

  /**
   * Get project by ID
   */
  async getProject(projectId?: number): Promise<any> {
    this.checkEnabled();

    const id = projectId || this.projectId;
    if (!id) {
      throw new Error('Project ID is required');
    }

    try {
      const response = await this.client!.get(`/get_project/${id}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get TestRail project ${id}:`, error);
      throw new Error('Failed to get TestRail project');
    }
  }

  /**
   * Get test suites for a project
   */
  async getSuites(projectId?: number): Promise<any[]> {
    this.checkEnabled();

    const id = projectId || this.projectId;
    if (!id) {
      throw new Error('Project ID is required');
    }

    try {
      const response = await this.client!.get(`/get_suites/${id}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get TestRail suites for project ${id}:`, error);
      throw new Error('Failed to get TestRail suites');
    }
  }

  /**
   * Get test cases for a suite
   */
  async getCases(projectId: number, suiteId: number): Promise<any[]> {
    this.checkEnabled();

    try {
      const response = await this.client!.get(`/get_cases/${projectId}&suite_id=${suiteId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get TestRail cases for suite ${suiteId}:`, error);
      throw new Error('Failed to get TestRail test cases');
    }
  }

  /**
   * Create a new test run in TestRail
   */
  async createTestRun(data: CreateTestRunDTO): Promise<TestRailRun> {
    this.checkEnabled();

    const projectId = this.projectId;
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    try {
      const payload = {
        name: data.name,
        description: data.description || '',
        suite_id: data.suiteId,
        milestone_id: data.milestoneId,
        assignedto_id: data.assignedToId,
        include_all: data.includeAll !== false,
        case_ids: data.caseIds || [],
      };

      const response = await this.client!.post(`/add_run/${projectId}`, payload);
      const testRun: TestRailRun = response.data;

      // Store the mapping in our database if we have an internal test run ID
      if (data.testRunId) {
        await prisma.testRailRun.create({
          data: {
            testRunId: data.testRunId,
            testRailRunId: testRun.id,
            projectId: projectId,
            suiteId: data.suiteId,
            name: testRun.name,
            // status field not in production schema
          },
        });
      }

      logger.info(`Created TestRail test run: ${testRun.id} (${testRun.name})`);
      return testRun;
    } catch (error) {
      logger.error('Failed to create TestRail test run:', error);
      throw new Error('Failed to create TestRail test run');
    }
  }

  /**
   * Add test results to a test run
   */
  async addTestResults(runId: number, results: AddTestResultDTO[]): Promise<void> {
    this.checkEnabled();

    try {
      const payload = {
        results: results.map(r => ({
          test_id: r.testId,
          status_id: r.statusId,
          comment: r.comment || '',
          elapsed: r.elapsed,
          defects: r.defects,
          version: r.version,
        })),
      };

      await this.client!.post(`/add_results_for_cases/${runId}`, payload);
      logger.info(`Added ${results.length} test results to TestRail run ${runId}`);
    } catch (error) {
      logger.error(`Failed to add test results to run ${runId}:`, error);
      throw new Error('Failed to add test results to TestRail');
    }
  }

  /**
   * Add a single test result
   */
  async addTestResult(runId: number, result: AddTestResultDTO): Promise<void> {
    this.checkEnabled();

    try {
      const payload = {
        status_id: result.statusId,
        comment: result.comment || '',
        elapsed: result.elapsed,
        defects: result.defects,
        version: result.version,
      };

      await this.client!.post(`/add_result_for_case/${runId}/${result.testId}`, payload);
      logger.info(`Added test result for test ${result.testId} in run ${runId}`);
    } catch (error) {
      logger.error(`Failed to add test result for test ${result.testId}:`, error);
      throw new Error('Failed to add test result to TestRail');
    }
  }

  /**
   * Close a test run
   */
  async closeTestRun(runId: number): Promise<void> {
    this.checkEnabled();

    try {
      await this.client!.post(`/close_run/${runId}`, {});
      logger.info(`Closed TestRail test run ${runId}`);
    } catch (error) {
      logger.error(`Failed to close TestRail run ${runId}:`, error);
      throw new Error('Failed to close TestRail test run');
    }
  }

  /**
   * Get test run by ID
   */
  async getTestRun(runId: number): Promise<TestRailRun> {
    this.checkEnabled();

    try {
      const response = await this.client!.get(`/get_run/${runId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get TestRail run ${runId}:`, error);
      throw new Error('Failed to get TestRail test run');
    }
  }

  /**
   * Get all test runs for a project
   */
  async getTestRuns(projectId?: number, filters?: { suite_id?: number; created_after?: number }): Promise<TestRailRun[]> {
    this.checkEnabled();

    const id = projectId || this.projectId;
    if (!id) {
      throw new Error('Project ID is required');
    }

    try {
      let url = `/get_runs/${id}`;
      const params = new URLSearchParams();

      if (filters?.suite_id) {
        params.append('suite_id', filters.suite_id.toString());
      }
      if (filters?.created_after) {
        params.append('created_after', filters.created_after.toString());
      }

      if (params.toString()) {
        url += `&${params.toString()}`;
      }

      const response = await this.client!.get(url);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get TestRail runs for project ${id}:`, error);
      throw new Error('Failed to get TestRail test runs');
    }
  }

  /**
   * Sync test results from our test run to TestRail
   */
  async syncTestRunResults(testRunId: string): Promise<void> {
    this.checkEnabled();

    try {
      // Get our internal test run
      const testRun = await prisma.testRun.findUnique({
        where: { id: testRunId },
        include: {
          results: true,
        },
      });

      if (!testRun) {
        throw new Error('Test run not found');
      }

      // Check if we have a TestRail run mapped
      const testRailMapping = await prisma.testRailRun.findFirst({
        where: { testRunId },
      });

      if (!testRailMapping) {
        throw new Error('TestRail run mapping not found');
      }

      // Convert our test results to TestRail format
      // Convert our test results to TestRail format
      // Production schema uses 'results' relation
      // @ts-expect-error - Handling schema difference between dev and prod
      const resultsToSync = testRun.results || testRun.testResults || [];

      const results: AddTestResultDTO[] = resultsToSync
        .filter((result: any) => result.testCaseId) // Only include results with testCaseId
        .map((result: any) => ({
          testId: parseInt(result.testCaseId!),
          statusId: this.mapStatusToTestRail(result.status),
          comment: result.error || result.message || '',
          elapsed: result.duration ? `${result.duration}s` : undefined,
        }));

      // Send results to TestRail
      await this.addTestResults(testRailMapping.testRailRunId, results);

      logger.info(`Synced ${results.length} test results from test run ${testRunId} to TestRail run ${testRailMapping.testRailRunId}`);
    } catch (error) {
      logger.error(`Failed to sync test run ${testRunId} to TestRail:`, error);
      throw new Error('Failed to sync test results to TestRail');
    }
  }

  /**
   * Map our test status to TestRail status ID
   */
  private mapStatusToTestRail(status: string): number {
    const statusMap: { [key: string]: number } = {
      'passed': TestRailStatus.PASSED,
      'success': TestRailStatus.PASSED,
      'failed': TestRailStatus.FAILED,
      'failure': TestRailStatus.FAILED,
      'blocked': TestRailStatus.BLOCKED,
      'skipped': TestRailStatus.UNTESTED,
      'pending': TestRailStatus.UNTESTED,
      'retest': TestRailStatus.RETEST,
    };

    return statusMap[status.toLowerCase()] || TestRailStatus.UNTESTED;
  }

  /**
   * Check if TestRail is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Export singleton instance
export const testRailService = new TestRailService();

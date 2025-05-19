import axios, { AxiosInstance } from 'axios';
import { Pipeline } from '@/models/pipeline.model';
import { TestRun } from '@/models/testRun.model';
import { logger } from '@/utils/logger';

interface JenkinsConfig {
  url: string;
  credentials: {
    username: string;
    apiToken: string;
  };
  repository?: string;
  branch?: string;
}

interface JenkinsBuildParams {
  branch?: string;
  parameters?: Record<string, any>;
}

interface JenkinsBuildResponse {
  id: string;
  url: string;
  result?: string;
  timestamp: number;
  duration: number;
  building: boolean;
}

export class JenkinsService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  private createAuthHeader(credentials: { username: string; apiToken: string }): string {
    return `Basic ${Buffer.from(`${credentials.username}:${credentials.apiToken}`).toString('base64')}`;
  }

  async validateConnection(config: JenkinsConfig): Promise<void> {
    try {
      const response = await this.client.get(`${config.url}/api/json`, {
        headers: {
          Authorization: this.createAuthHeader(config.credentials),
        },
      });

      if (response.status !== 200) {
        throw new Error('Failed to connect to Jenkins');
      }

      logger.info('Jenkins connection validated successfully');
    } catch (error) {
      logger.error('Jenkins connection validation failed:', error);
      throw new Error('Failed to connect to Jenkins: ' + (error as Error).message);
    }
  }

  async startPipeline(pipeline: Pipeline): Promise<TestRun> {
    const { config } = pipeline;
    const buildParams: JenkinsBuildParams = {
      branch: config.branch,
    };

    try {
      // Create test run record
      const testRun = await TestRun.create({
        pipelineId: pipeline.id,
        userId: pipeline.userId,
        status: 'pending',
        branch: config.branch,
        startTime: new Date(),
      });

      // Trigger Jenkins build
      const response = await this.client.post(
        `${config.url}/job/${encodeURIComponent(pipeline.name)}/buildWithParameters`,
        buildParams,
        {
          headers: {
            Authorization: this.createAuthHeader(config.credentials),
          },
        }
      );

      if (response.status !== 201) {
        throw new Error('Failed to trigger Jenkins build');
      }

      // Get queue item location
      const queueUrl = response.headers.location;
      const buildDetails = await this.waitForBuildStart(queueUrl, config.credentials);

      // Update test run with build details
      await testRun.update({
        status: 'running',
        parameters: buildParams,
      });

      // Start monitoring build progress
      this.monitorBuildProgress(buildDetails.url, config.credentials, testRun);

      return testRun;
    } catch (error) {
      logger.error('Failed to start Jenkins pipeline:', error);
      throw error;
    }
  }

  private async waitForBuildStart(queueUrl: string, credentials: { username: string; apiToken: string }): Promise<JenkinsBuildResponse> {
    let attempts = 0;
    const maxAttempts = 10;
    const delay = 2000;

    while (attempts < maxAttempts) {
      try {
        const response = await this.client.get(queueUrl, {
          headers: {
            Authorization: this.createAuthHeader(credentials),
          },
        });

        if (response.data.executable) {
          return response.data.executable;
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        attempts++;
      } catch (error) {
        logger.error('Error waiting for build to start:', error);
        throw error;
      }
    }

    throw new Error('Build failed to start after maximum attempts');
  }

  private async monitorBuildProgress(
    buildUrl: string,
    credentials: { username: string; apiToken: string },
    testRun: TestRun
  ): Promise<void> {
    const pollInterval = 10000; // 10 seconds
    const maxDuration = 3600000; // 1 hour
    let elapsed = 0;

    const intervalId = setInterval(async () => {
      try {
        const response = await this.client.get(`${buildUrl}/api/json`, {
          headers: {
            Authorization: this.createAuthHeader(credentials),
          },
        });

        const buildData: JenkinsBuildResponse = response.data;

        if (!buildData.building) {
          clearInterval(intervalId);
          await this.processBuildCompletion(buildData, testRun);
        }

        elapsed += pollInterval;
        if (elapsed >= maxDuration) {
          clearInterval(intervalId);
          await testRun.update({
            status: 'timeout',
            error: 'Build exceeded maximum duration',
          });
        }
      } catch (error) {
        logger.error('Error monitoring build progress:', error);
        clearInterval(intervalId);
        await testRun.update({
          status: 'failure',
          error: `Failed to monitor build: ${(error as Error).message}`,
        });
      }
    }, pollInterval);
  }

  private async processBuildCompletion(buildData: JenkinsBuildResponse, testRun: TestRun): Promise<void> {
    const status = buildData.result?.toLowerCase() === 'success' ? 'success' : 'failure';
    
    await testRun.update({
      status,
      endTime: new Date(buildData.timestamp + buildData.duration),
      duration: Math.floor(buildData.duration / 1000),
      results: await this.fetchTestResults(buildData.url, testRun.pipeline!.config.credentials),
    });
  }

  private async fetchTestResults(buildUrl: string, credentials: { username: string; apiToken: string }): Promise<any> {
    try {
      const response = await this.client.get(`${buildUrl}/testReport/api/json`, {
        headers: {
          Authorization: this.createAuthHeader(credentials),
        },
      });

      const testReport = response.data;
      return {
        total: testReport.totalCount,
        passed: testReport.passCount,
        failed: testReport.failCount,
        skipped: testReport.skipCount,
        flaky: 0, // Determine flaky tests based on test history
        reportUrl: `${buildUrl}/testReport`,
      };
    } catch (error) {
      logger.warn('Failed to fetch test results:', error);
      return null;
    }
  }
}
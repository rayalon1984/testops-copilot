import axios, { AxiosInstance } from 'axios';
import { Pipeline, TestRun, PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';

const prisma = new PrismaClient();

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
    const config = typeof pipeline.config === 'string' ? JSON.parse(pipeline.config) : pipeline.config;
    const buildParams: JenkinsBuildParams = {
      branch: config.branch,
    };

    try {
      // Create test run record
      const testRun = await prisma.testRun.create({
        data: {
          pipelineId: pipeline.id,
          userId: pipeline.userId,
          status: 'PENDING',
          branch: config.branch,
          startTime: new Date(),
          name: pipeline.name,
        }
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
      const updatedTestRun = await prisma.testRun.update({
        where: { id: testRun.id },
        data: {
          status: 'RUNNING',
          // parameters: JSON.stringify(buildParams),
        }
      });

      // Start monitoring build progress
      this.monitorBuildProgress(buildDetails.url, config.credentials, updatedTestRun);

      return updatedTestRun;
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
          await prisma.testRun.update({
            where: { id: testRun.id },
            data: {
              status: 'TIMEOUT',
              error: 'Build exceeded maximum duration',
            }
          });
        }
      } catch (error) {
        logger.error('Error monitoring build progress:', error);
        clearInterval(intervalId);
        await prisma.testRun.update({
          where: { id: testRun.id },
          data: {
            status: 'FAILED',
            error: `Failed to monitor build: ${(error as Error).message}`,
          }
        });
      }
    }, pollInterval);
  }

  private async processBuildCompletion(buildData: JenkinsBuildResponse, testRun: TestRun): Promise<void> {
    const status = buildData.result?.toLowerCase() === 'success' ? 'PASSED' : 'FAILED';

    // Fetch pipeline to get config
    const pipeline = await prisma.pipeline.findUnique({ where: { id: testRun.pipelineId } });
    if (!pipeline) return;

    const config = typeof pipeline.config === 'string' ? JSON.parse(pipeline.config) : pipeline.config;
    const results = await this.fetchTestResults(buildData.url, config.credentials);

    await prisma.testRun.update({
      where: { id: testRun.id },
      data: {
        status,
        endTime: new Date(buildData.timestamp + buildData.duration),
        duration: Math.floor(buildData.duration / 1000),
        results: results ? JSON.stringify(results) : null,
      },
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
        flaky: 0,
        reportUrl: `${buildUrl}/testReport`,
      };
    } catch (error) {
      logger.warn('Failed to fetch test results:', error);
      return null;
    }
  }
}
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  UserRole,
  PipelineType,
  TestStatus,
  TestResult,
  NotificationType,
} from '../src/types/prisma';

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.notification.deleteMany();
  await prisma.testCase.deleteMany();
  await prisma.testRun.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.user.deleteMany();

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'rayalon@gmail.com',
      name: 'Admin User',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
    },
  });

  // Create demo user
  const userPassword = await bcrypt.hash('demo123', 10);
  const demoUser = await prisma.user.create({
    data: {
      email: 'rayalon+demo@gmail.com',
      name: 'Demo User',
      passwordHash: userPassword,
      role: UserRole.USER,
    },
  });

  // Create sample pipelines
  const jenkinsConfig = {
    url: 'https://jenkins.example.com',
    jobName: 'test-automation',
    credentialId: 'jenkins-api-token',
  };

  const githubConfig = {
    repository: 'testops-companion',
    workflow: 'test.yml',
    branch: 'main',
  };

  const jenkinsPipeline = await prisma.pipeline.create({
    data: {
      name: 'Main Test Suite',
      description: 'Core test automation pipeline running on Jenkins',
      type: PipelineType.JENKINS,
      config: jenkinsConfig,
      userId: admin.id,
    },
  });

  const githubPipeline = await prisma.pipeline.create({
    data: {
      name: 'GitHub CI Tests',
      description: 'Integration tests running on GitHub Actions',
      type: PipelineType.GITHUB_ACTIONS,
      config: githubConfig,
      userId: demoUser.id,
    },
  });

  // Create sample test runs
  const testRun1 = await prisma.testRun.create({
    data: {
      pipelineId: jenkinsPipeline.id,
      status: TestStatus.COMPLETED,
      result: TestResult.PASSED,
      userId: admin.id,
      endedAt: new Date(),
      logs: 'All tests passed successfully',
      metadata: {
        duration: 345,
        environment: 'staging',
        browser: 'chrome',
      },
    },
  });

  const testRun2 = await prisma.testRun.create({
    data: {
      pipelineId: githubPipeline.id,
      status: TestStatus.COMPLETED,
      result: TestResult.FAILED,
      userId: demoUser.id,
      endedAt: new Date(),
      logs: 'Some tests failed',
      metadata: {
        duration: 256,
        environment: 'development',
        browser: 'firefox',
      },
    },
  });

  // Create sample test cases
  await prisma.testCase.create({
    data: {
      name: 'User Login Test',
      description: 'Verify user can login with valid credentials',
      testRunId: testRun1.id,
      status: TestStatus.COMPLETED,
      result: TestResult.PASSED,
      duration: 1500,
      metadata: {
        priority: 'high',
        component: 'authentication',
      },
    },
  });

  await prisma.testCase.create({
    data: {
      name: 'Data Export Test',
      description: 'Verify data export functionality',
      testRunId: testRun2.id,
      status: TestStatus.COMPLETED,
      result: TestResult.FAILED,
      duration: 2300,
      errorMessage: 'Timeout waiting for export completion',
      stackTrace: 'Error: Timeout\n    at ExportPage.waitForExport (/tests/export.test.ts:123)',
      metadata: {
        priority: 'medium',
        component: 'data-management',
      },
    },
  });

  // Create sample notifications
  await prisma.notification.create({
    data: {
      type: NotificationType.TEST_FAILURE,
      title: 'Test Failure Alert',
      message: 'Data Export Test failed in GitHub CI Tests pipeline',
      userId: demoUser.id,
      metadata: {
        pipelineId: githubPipeline.id,
        testRunId: testRun2.id,
      },
    },
  });

  await prisma.notification.create({
    data: {
      type: NotificationType.PIPELINE_STATUS,
      title: 'Pipeline Completed',
      message: 'Main Test Suite completed successfully',
      userId: admin.id,
      metadata: {
        pipelineId: jenkinsPipeline.id,
        testRunId: testRun1.id,
      },
    },
  });

  console.log('Database has been seeded with sample data');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
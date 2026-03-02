/**
 * High-Fidelity Development Seed — TypeScript + Faker
 *
 * Generates 30 days of realistic, interconnected demo data across ALL models.
 * Designed so dashboards, metrics, charts, and AI features immediately feel alive.
 *
 * Usage:  npx ts-node prisma/seed.dev.ts
 *         (or via npm run dev:simple:seed after updating package.json)
 *
 * Uses a comprehensive seeding approach with Faker for realistic demo data.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { faker } from '@faker-js/faker';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Constants ────────────────────────────────────────────────────────

const DAYS_OF_HISTORY = 30;
const NOW = Date.now();

const ms = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
};

function daysAgo(n: number): Date {
  return new Date(NOW - n * ms.day);
}

function hoursAgo(n: number): Date {
  return new Date(NOW - n * ms.hour);
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Pipeline Templates ───────────────────────────────────────────────

const PIPELINE_TEMPLATES = [
  { name: 'E2E Test Suite - Production', type: 'GITHUB_ACTIONS', description: 'End-to-end tests for production environment' },
  { name: 'API Integration Tests', type: 'JENKINS', description: 'REST API integration testing suite' },
  { name: 'Unit Tests - Backend', type: 'GITHUB_ACTIONS', description: 'Unit tests for backend services' },
  { name: 'Unit Tests - Frontend', type: 'GITHUB_ACTIONS', description: 'Unit tests for React components' },
  { name: 'Security Scan Pipeline', type: 'CUSTOM', description: 'OWASP and dependency vulnerability scans' },
  { name: 'Performance Tests', type: 'JENKINS', description: 'Load and stress testing suite' },
  { name: 'Mobile App Tests - iOS', type: 'GITHUB_ACTIONS', description: 'Automated tests for iOS application' },
  { name: 'Mobile App Tests - Android', type: 'GITHUB_ACTIONS', description: 'Automated tests for Android application' },
  { name: 'Database Migration Tests', type: 'JENKINS', description: 'Automated database migration validation' },
  { name: 'Smoke Tests - Staging', type: 'CUSTOM', description: 'Quick smoke tests for staging deployments' },
  { name: 'Visual Regression Tests', type: 'GITHUB_ACTIONS', description: 'Screenshot comparison tests' },
  { name: 'Accessibility Tests', type: 'CUSTOM', description: 'WCAG compliance validation' },
  { name: 'Cross-Browser Tests', type: 'JENKINS', description: 'Chrome, Firefox, Safari compatibility' },
  { name: 'Microservices Health Check', type: 'CUSTOM', description: 'Service health and connectivity tests' },
  { name: 'Payment Gateway Tests', type: 'JENKINS', description: 'Payment processing integration tests' },
];

// ─── Sample failure templates ─────────────────────────────────────────

const FAILURE_TEMPLATES = [
  { testName: 'PaymentProcessor.processCheckout', errorType: 'NullPointerException', errorMessage: 'Cannot read property "total" of null in payment calculation', stackTrace: 'at PaymentService.calculateTotal (src/services/payment.ts:142:28)\nat CheckoutController.processOrder (src/controllers/checkout.ts:89:15)', rootCause: 'Missing null check when cart items array is empty', solution: 'Add validation to check if cart.items exists and has length > 0', prevention: 'Add unit tests for edge cases including empty carts' },
  { testName: 'AuthenticationFlow.loginWithOAuth', errorType: 'TimeoutException', errorMessage: 'OAuth provider did not respond within 5000ms', stackTrace: 'at OAuthClient.exchangeToken (src/auth/oauth.ts:234:19)\nat AuthController.handleCallback (src/controllers/auth.ts:167:22)', rootCause: 'Network latency to third-party OAuth provider exceeds timeout', solution: 'Increase timeout to 10s and add retry logic with exponential backoff', prevention: 'Mock OAuth calls in tests, add monitoring for provider response times' },
  { testName: 'UserRegistration.validateEmail', errorType: 'ValidationError', errorMessage: 'Email format validation failed for user@subdomain.domain.com', stackTrace: 'at EmailValidator.validate (src/utils/validators.ts:45:11)\nat UserService.register (src/services/user.ts:78:23)', rootCause: 'Regex pattern too strict - rejects valid emails with subdomains', solution: 'Update email validation regex to support all valid RFC 5322 formats', prevention: 'Use well-tested email validation library like validator.js' },
  { testName: 'DataSync.syncUserProfiles', errorType: 'ConcurrencyException', errorMessage: 'Database deadlock detected during batch update', stackTrace: 'at DatabaseClient.executeBatch (src/db/client.ts:189:15)\nat SyncService.updateProfiles (src/services/sync.ts:92:20)', rootCause: 'Multiple sync jobs running simultaneously causing row-level locks', solution: 'Implement distributed lock using Redis before starting sync', prevention: 'Add job queue with single-worker constraint for sync operations' },
  { testName: 'SearchAPI.queryProducts', errorType: 'AssertionError', errorMessage: 'Expected 10 results but got 9 - test data inconsistency', stackTrace: 'at Object.<anonymous> (tests/api/search.test.ts:67:8)', rootCause: 'Test data includes a product that was soft-deleted', solution: 'Update test to filter out soft-deleted items or use stable test fixtures', prevention: 'Use transaction-based test isolation to prevent data pollution' },
  { testName: 'ConfigLoader.loadDatabaseSettings', errorType: 'ConfigurationError', errorMessage: 'Missing required environment variable: DB_POOL_SIZE', stackTrace: 'at ConfigService.validate (src/config/service.ts:123:13)\nat ConfigService.load (src/config/service.ts:56:10)', rootCause: 'Environment variable not set in staging deployment configuration', solution: 'Add DB_POOL_SIZE=20 to staging environment variables', prevention: 'Add env var validation at app startup with clear error messages' },
  { testName: 'FileUpload.processImage', errorType: 'OutOfMemoryError', errorMessage: 'Heap out of memory during image processing - 50MB file', stackTrace: 'at ImageProcessor.resize (src/media/processor.ts:78:15)\nat UploadController.handleFile (src/controllers/upload.ts:45:19)', rootCause: 'Loading entire 50MB image into memory before processing', solution: 'Use streaming image processing with sharp library', prevention: 'Add file size limits and process images in chunks with stream API' },
  { testName: 'NotificationService.sendEmail', errorType: 'NetworkError', errorMessage: 'SMTP connection refused on port 587', stackTrace: 'at SMTPClient.connect (nodemailer/lib/smtp-connection/index.js:389:17)\nat EmailService.send (src/services/email.ts:156:12)', rootCause: 'Firewall blocking outbound SMTP on test environment', solution: 'Update firewall rules or use environment-specific SMTP relay', prevention: 'Mock email service in tests, add smoke tests for SMTP connectivity' },
  { testName: 'ShoppingCart.calculateTax', errorType: 'ArithmeticException', errorMessage: 'Division by zero in tax calculation for international orders', stackTrace: 'at TaxService.calculate (src/services/tax.ts:89:24)\nat CartService.getTotal (src/services/cart.ts:156:18)', rootCause: 'Missing tax rate configuration for newly added country code', solution: 'Add default tax rate fallback and validation for supported countries', prevention: 'Implement comprehensive country/tax rate validation' },
  { testName: 'WebSocket.handleConnection', errorType: 'ConnectionError', errorMessage: 'WebSocket connection dropped after 30 seconds', stackTrace: 'at WebSocketServer.onConnection (src/websocket/server.ts:234:15)\nat Socket.emit (events.js:315:20)', rootCause: 'Load balancer timeout shorter than application keepalive interval', solution: 'Reduce ping interval to 20s and configure LB timeout to 60s', prevention: 'Add automated tests for long-lived WebSocket connections' },
  { testName: 'ThirdPartyAPI.fetchUserData', errorType: 'UnknownError', errorMessage: 'Unexpected response format from external API', stackTrace: 'at APIClient.parseResponse (src/integrations/api-client.ts:198:11)', rootCause: 'External API changed response schema without notice', solution: 'Add response validation and fallback handling', prevention: 'Implement contract testing with external API providers' },
  { testName: 'ReportGenerator.createPDF', errorType: 'UnknownError', errorMessage: 'Phantom process exited with code 139 (SIGSEGV)', stackTrace: 'at ChildProcess.exithandler (child_process.js:290:12)', rootCause: 'Segmentation fault in headless browser - cause unclear', solution: 'Update to latest Chrome driver, add memory limits', prevention: 'Monitor crash reports, add health checks for browser processes' },
  { testName: 'CacheService.retrieve', errorType: 'UnknownError', errorMessage: 'Redis connection intermittently returns READONLY', stackTrace: 'at RedisClient.handleReply (redis/lib/parser/javascript.js:68:14)\nat CacheService.get (src/services/cache.ts:134:19)', rootCause: 'Redis failover causing temporary readonly state', solution: 'Add retry logic with exponential backoff', prevention: 'Set up Redis monitoring, add alerts for failover events' },
];

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const CATEGORIES = ['bug_critical', 'bug_minor', 'environment', 'flaky', 'configuration', 'unknown'];

const AI_PROVIDERS = [
  { name: 'anthropic', model: 'claude-opus-4-6', avgPromptTokens: 800, avgCompletionTokens: 400, avgCost: 0.108 },
  { name: 'openai', model: 'gpt-4.1', avgPromptTokens: 1000, avgCompletionTokens: 500, avgCost: 0.06 },
  { name: 'google', model: 'gemini-3.0-flash', avgPromptTokens: 700, avgCompletionTokens: 400, avgCost: 0.000825 },
  { name: 'openrouter', model: 'meta-llama/llama-4-maverick', avgPromptTokens: 900, avgCompletionTokens: 400, avgCost: 0.003 },
];

const AI_FEATURES = ['rca', 'categorization', 'log-summary', 'chat', 'prediction'];

const JIRA_STATUSES = ['Open', 'In Progress', 'In Review', 'Done', 'Closed'];
const JIRA_PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

// ─── Seed Function ────────────────────────────────────────────────────

async function seed() {
  console.log('Seeding development database with high-fidelity demo data...\n');

  // ── Clean slate (transactional to avoid partial cleanup) ──
  console.log('Clearing existing data...');
  await prisma.$transaction([
    prisma.channelUserMapping.deleteMany(),
    prisma.sharedAnalysis.deleteMany(),
    prisma.dashboardConfig.deleteMany(),
    prisma.teamMember.deleteMany(),
    prisma.pendingAction.deleteMany(),
    prisma.chatMessage.deleteMany(),
    prisma.chatSession.deleteMany(),
    prisma.aIUsage.deleteMany(),
    prisma.aIProviderConfig.deleteMany(),
    prisma.rCARevision.deleteMany(),
    prisma.failureComment.deleteMany(),
    prisma.failureArchive.deleteMany(),
    prisma.failurePattern.deleteMany(),
    prisma.testResult.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.healingEvent.deleteMany(),
    prisma.healingRule.deleteMany(),
    prisma.quarantinedTest.deleteMany(),
    prisma.testRun.deleteMany(),
    prisma.jiraIssue.deleteMany(),
    prisma.jiraConfig.deleteMany(),
    prisma.confluencePage.deleteMany(),
    prisma.testRailRun.deleteMany(),
    prisma.pipeline.deleteMany(),
    prisma.team.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // ── 1. Users ──
  console.log('Creating users...');
  const demoHash = await bcrypt.hash('demo123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@testops.ai',
      password: demoHash,
      firstName: 'Dana',
      lastName: 'Reeves',
      role: 'ADMIN',
      autonomyLevel: 'autonomous',
    },
  });

  const lead = await prisma.user.create({
    data: {
      email: 'lead@testops.ai',
      password: demoHash,
      firstName: 'Jordan',
      lastName: 'Chen',
      role: 'USER',
      autonomyLevel: 'autonomous',
    },
  });

  const engineer = await prisma.user.create({
    data: {
      email: 'engineer@testops.ai',
      password: demoHash,
      firstName: 'Alex',
      lastName: 'Moreno',
      role: 'USER',
      autonomyLevel: 'balanced',
    },
  });

  const viewer = await prisma.user.create({
    data: {
      email: 'viewer@testops.ai',
      password: demoHash,
      firstName: 'Sam',
      lastName: 'Patel',
      role: 'USER',
      autonomyLevel: 'conservative',
    },
  });

  const users = [admin, lead, engineer, viewer];
  console.log(`  Created ${users.length} users`);

  // ── 2. Teams ──
  console.log('Creating teams...');
  const team = await prisma.team.create({
    data: {
      name: 'Platform Engineering',
      slug: 'platform-eng',
      description: 'Core platform and infrastructure team',
      createdBy: admin.id,
    },
  });

  const team2 = await prisma.team.create({
    data: {
      name: 'QA Automation',
      slug: 'qa-automation',
      description: 'Test automation and quality assurance',
      createdBy: lead.id,
    },
  });

  await prisma.teamMember.createMany({
    data: [
      { teamId: team.id, userId: admin.id, role: 'OWNER' },
      { teamId: team.id, userId: lead.id, role: 'ADMIN' },
      { teamId: team.id, userId: engineer.id, role: 'MEMBER' },
      { teamId: team.id, userId: viewer.id, role: 'VIEWER' },
      { teamId: team2.id, userId: lead.id, role: 'OWNER' },
      { teamId: team2.id, userId: admin.id, role: 'ADMIN' },
      { teamId: team2.id, userId: engineer.id, role: 'MEMBER' },
      { teamId: team2.id, userId: viewer.id, role: 'VIEWER' },
    ],
  });

  console.log('  Created 2 teams with 8 memberships');

  // ── 3. Pipelines ──
  console.log('Creating pipelines...');
  const pipelines: Array<{ id: string; name: string; [k: string]: any }> = [];
  for (const tpl of PIPELINE_TEMPLATES) {
    const pipeline = await prisma.pipeline.create({
      data: {
        name: tpl.name,
        type: tpl.type,
        repository: `org/testops-${faker.helpers.slugify(tpl.name).toLowerCase()}`,
        branch: 'main',
        config: JSON.stringify({
          triggers: ['push', 'pull_request'],
          notifications: { email: true, slack: true },
        }),
        enabled: true,
        teamId: pick([team.id, team2.id]),
        lastRunAt: daysAgo(randomBetween(0, 3)),
      },
    });
    pipelines.push(pipeline);
  }

  console.log(`  Created ${pipelines.length} pipelines`);

  // ── 4. Test Runs + Test Results (30 days) ──
  console.log('Creating test runs and results...');
  const commits = Array.from({ length: 25 }, () => faker.git.commitSha().slice(0, 7));
  const branches = ['main', 'develop', 'feature/auth-v2', 'feature/metrics', 'fix/flaky-tests', 'release/2.9.0'];
  const testRunPayloads: Prisma.TestRunCreateManyInput[] = [];
  const testResultPayloads: Prisma.TestResultCreateManyInput[] = [];

  for (let i = 0; i < 200; i++) {
    const pipeline = pipelines[i % pipelines.length];
    const hoursOffset = randomBetween(0, DAYS_OF_HISTORY * 24);
    const startTime = hoursAgo(hoursOffset);
    const durationSec = randomBetween(120, 3600);
    const endTime = new Date(startTime.getTime() + durationSec * 1000);

    const runId = crypto.randomUUID();
    const commit = commits[i % commits.length];
    const passedCount = randomBetween(150, 600);
    const failedCount = Math.random() > 0.65 ? randomBetween(1, 40) : 0;
    const skippedCount = randomBetween(0, 20);
    const flakyCount = Math.random() > 0.8 ? randomBetween(1, 8) : 0;
    const status = failedCount > 0 ? 'FAILED' : 'PASSED';

    testRunPayloads.push({
      id: runId,
      pipelineId: pipeline.id,
      userId: pick(users).id,
      name: `${pipeline.name} #${i + 1}`,
      status,
      branch: pick(branches),
      commit,
      startedAt: startTime,
      completedAt: endTime,
      duration: durationSec,
      totalTests: passedCount + failedCount + skippedCount + flakyCount,
      passed: passedCount,
      failed: failedCount,
      skipped: skippedCount,
      flaky: flakyCount,
      buildNumber: `${randomBetween(1000, 9999)}`,
    });

    // Generate 2-4 individual test results per run
    const resultCount = randomBetween(2, 4);
    for (let r = 0; r < resultCount; r++) {
      const tpl = pick(FAILURE_TEMPLATES);
      const isFailed = r === 0 && failedCount > 0;
      const isFlaky = r === 1 && flakyCount > 0;

      testResultPayloads.push({
        testRunId: runId,
        name: tpl.testName,
        className: tpl.testName.split('.')[0],
        status: isFlaky ? 'FLAKY' : isFailed ? 'FAILED' : 'PASSED',
        duration: randomBetween(50, 5000),
        error: isFailed ? tpl.errorMessage : null,
        stackTrace: isFailed ? tpl.stackTrace : null,
        // ~30% of results linked to Xray test cases for demo
        externalTestCaseId: Math.random() < 0.3 ? `PROJ-TC-${randomBetween(100, 199)}` : null,
        createdAt: endTime,
      });
    }
  }

  await prisma.testRun.createMany({ data: testRunPayloads });
  await prisma.testResult.createMany({ data: testResultPayloads });
  const testRuns = await prisma.testRun.findMany({ select: { id: true, pipelineId: true, status: true } });

  console.log(`  Created ${testRuns.length} test runs, ${testResultPayloads.length} test results`);

  // ── 5. Failure Archive (1600+ failures) ──
  console.log('Creating failure archives...');
  const failurePayloads: Prisma.FailureArchiveCreateManyInput[] = [];
  const categoryCounts: Record<string, number> = {
    bug_critical: 280,
    bug_minor: 420,
    environment: 190,
    flaky: 315,
    configuration: 245,
    unknown: 150,
  };

  for (const [category, count] of Object.entries(categoryCounts)) {
    for (let i = 0; i < count; i++) {
      const tpl = pick(FAILURE_TEMPLATES);
      const dayOffset = randomBetween(0, 60);
      const firstSeen = daysAgo(dayOffset + randomBetween(0, 14));
      const lastSeen = daysAgo(dayOffset);
      const resolved = Math.random() > 0.7;

      failurePayloads.push({
        testName: `${tpl.testName}_${category}_${i}`,
        errorMessage: tpl.errorMessage,
        category,
        stackTrace: tpl.stackTrace,
        rootCause: tpl.rootCause,
        solution: tpl.solution,
        prevention: tpl.prevention,
        severity: pick(SEVERITIES),
        occurrenceCount: randomBetween(1, 25),
        firstOccurrence: firstSeen,
        lastOccurrence: lastSeen,
        rcaDocumented: Math.random() > 0.4,
        resolved,
        resolvedAt: resolved ? daysAgo(randomBetween(0, dayOffset)) : null,
        tags: faker.helpers.arrayElements(['regression', 'env-issue', 'flaky', 'data-issue', 'timeout', 'oom', 'auth', 'network'], randomBetween(1, 3)).join(','),
      });
    }
  }

  await prisma.failureArchive.createMany({ data: failurePayloads });
  const failures = await prisma.failureArchive.findMany({ select: { id: true, testName: true }, take: 50 });

  console.log(`  Created ${failurePayloads.length} failure archives`);

  // ── 6. RCA Revisions (on first 30 failures) ──
  console.log('Creating RCA revisions...');
  const rcaPayloads: Prisma.RCARevisionCreateManyInput[] = [];
  for (const failure of failures.slice(0, 30)) {
    const revisionCount = randomBetween(1, 4);
    for (let v = 1; v <= revisionCount; v++) {
      rcaPayloads.push({
        failureArchiveId: failure.id,
        version: v,
        rootCause: faker.lorem.sentence(),
        solution: faker.lorem.sentence(),
        prevention: faker.lorem.sentence(),
        editedBy: pick(users).id,
        editSummary: v === 1 ? 'Initial RCA' : `Revision ${v}: ${faker.lorem.words(3)}`,
        createdAt: daysAgo(randomBetween(0, 20)),
      });
    }
  }

  await prisma.rCARevision.createMany({ data: rcaPayloads });
  console.log(`  Created ${rcaPayloads.length} RCA revisions`);

  // ── 7. Failure Comments ──
  console.log('Creating failure comments...');
  const commentPayloads: Prisma.FailureCommentCreateManyInput[] = [];
  for (const failure of failures.slice(0, 40)) {
    const commentCount = randomBetween(1, 5);
    for (let c = 0; c < commentCount; c++) {
      commentPayloads.push({
        failureArchiveId: failure.id,
        userId: pick(users).id,
        content: faker.lorem.paragraph(),
        createdAt: daysAgo(randomBetween(0, 15)),
      });
    }
  }

  await prisma.failureComment.createMany({ data: commentPayloads });
  console.log(`  Created ${commentPayloads.length} failure comments`);

  // ── 8. Failure Patterns ──
  console.log('Creating failure patterns...');
  const patternPayloads = [
    { signature: 'timeout-oauth-flow', patternName: 'OAuth Timeout Pattern', description: 'OAuth provider timeouts spike during peak hours', affectedTests: 'AuthenticationFlow.loginWithOAuth,AuthenticationFlow.refreshToken', commonRootCause: 'Third-party provider rate limiting', matchCount: 47, confidence: 0.89 },
    { signature: 'null-payment-cart', patternName: 'Null Cart Pattern', description: 'Payment processing fails when cart is empty or null', affectedTests: 'PaymentProcessor.processCheckout,CartService.getTotal', commonRootCause: 'Missing null checks in payment flow', matchCount: 23, confidence: 0.95 },
    { signature: 'flaky-websocket', patternName: 'WebSocket Flaky Pattern', description: 'WebSocket tests intermittently fail due to timing', affectedTests: 'WebSocket.handleConnection,WebSocket.broadcast', commonRootCause: 'Race condition in connection establishment', matchCount: 112, confidence: 0.72 },
    { signature: 'env-smtp-blocked', patternName: 'SMTP Blocked Pattern', description: 'Email tests fail in restricted environments', affectedTests: 'NotificationService.sendEmail,AlertService.notify', commonRootCause: 'Firewall blocks outbound SMTP', matchCount: 31, confidence: 0.98 },
    { signature: 'oom-image-processing', patternName: 'Image OOM Pattern', description: 'Large image uploads cause out-of-memory crashes', affectedTests: 'FileUpload.processImage,MediaService.resize', commonRootCause: 'Entire image loaded into memory', matchCount: 8, confidence: 0.91 },
  ];

  await prisma.failurePattern.createMany({
    data: patternPayloads.map((p) => ({
      ...p,
      lastMatched: daysAgo(randomBetween(0, 7)),
      isActive: true,
    })),
  });

  console.log(`  Created ${patternPayloads.length} failure patterns`);

  // ── 9. AI Usage Records (20K+) ──
  console.log('Creating AI usage records (batched)...');
  let aiUsageCount = 0;
  const BATCH_SIZE = 500;

  for (let day = 0; day < 60; day++) {
    let batch: Prisma.AIUsageCreateManyInput[] = [];

    for (const provider of AI_PROVIDERS) {
      const callsPerDay = randomBetween(40, 160);

      for (let call = 0; call < callsPerDay; call++) {
        const isCached = Math.random() > 0.35;
        const promptTokens = isCached ? 0 : provider.avgPromptTokens + randomBetween(-100, 200);
        const completionTokens = isCached ? 0 : provider.avgCompletionTokens + randomBetween(-100, 200);

        batch.push({
          provider: provider.name,
          model: provider.model,
          feature: pick(AI_FEATURES),
          promptTokens: Math.max(0, promptTokens),
          completionTokens: Math.max(0, completionTokens),
          totalTokens: Math.max(0, promptTokens) + Math.max(0, completionTokens),
          cost: isCached ? 0 : +(provider.avgCost * (0.7 + Math.random() * 0.6)).toFixed(6),
          userId: pick(users).id,
          createdAt: new Date(NOW - day * ms.day - Math.random() * ms.day),
        });

        if (batch.length >= BATCH_SIZE) {
          await prisma.aIUsage.createMany({ data: batch });
          aiUsageCount += batch.length;
          batch = [];
          process.stdout.write('.');
        }
      }
    }

    if (batch.length > 0) {
      await prisma.aIUsage.createMany({ data: batch });
      aiUsageCount += batch.length;
    }
  }

  console.log(`\n  Created ${aiUsageCount} AI usage records`);

  // ── 10. AI Provider Config ──
  await prisma.aIProviderConfig.create({
    data: {
      id: 'singleton',
      provider: 'mock',
      model: 'mock-model',
      apiKey: null,
      extraConfig: null,
      updatedBy: admin.id,
    },
  });

  console.log('  Created AI provider config (mock)');

  // ── 11. Chat Sessions + Messages ──
  console.log('Creating chat sessions and messages...');
  let messageCount = 0;

  const chatTopics = [
    { title: 'Investigate PaymentProcessor failures', persona: 'investigator' },
    { title: 'E2E flaky test analysis', persona: 'test-strategist' },
    { title: 'Jenkins build failure root cause', persona: 'devops-engineer' },
    { title: 'Weekly failure metrics review', persona: 'metrics-analyst' },
    { title: 'Release 2.9.0 readiness check', persona: 'release-manager' },
    { title: 'Onboarding: How to read failure dashboards', persona: 'onboarding-buddy' },
    { title: 'Production incident post-mortem', persona: 'incident-commander' },
    { title: 'Document flaky test runbook', persona: 'knowledge-curator' },
  ];

  for (const topic of chatTopics) {
    const session = await prisma.chatSession.create({
      data: {
        userId: pick([admin, engineer]).id,
        title: topic.title,
        activePersona: topic.persona,
        createdAt: daysAgo(randomBetween(0, 14)),
      },
    });

    // Generate a realistic conversation (4-8 exchanges)
    const exchanges = randomBetween(4, 8);
    const messagePayloads: Prisma.ChatMessageCreateManyInput[] = [];

    for (let e = 0; e < exchanges; e++) {
      const time = new Date(session.createdAt.getTime() + e * 60_000);

      messagePayloads.push({
        sessionId: session.id,
        role: 'user',
        content: faker.lorem.sentence(),
        persona: null,
        createdAt: time,
      });

      messagePayloads.push({
        sessionId: session.id,
        role: 'assistant',
        content: faker.lorem.paragraph(),
        persona: topic.persona,
        createdAt: new Date(time.getTime() + 5_000),
      });

      // Occasionally add tool calls
      if (Math.random() > 0.5) {
        const toolName = pick(['jira_get', 'jira_search', 'jenkins_get_status', 'github_get_pr', 'dashboard_metrics']);
        messagePayloads.push({
          sessionId: session.id,
          role: 'tool_start',
          content: JSON.stringify({ tool: toolName }),
          toolName,
          persona: topic.persona,
          createdAt: new Date(time.getTime() + 3_000),
        });
        messagePayloads.push({
          sessionId: session.id,
          role: 'tool_result',
          content: JSON.stringify({ status: 'ok', data: {} }),
          toolName,
          persona: topic.persona,
          createdAt: new Date(time.getTime() + 4_000),
        });
      }
    }

    await prisma.chatMessage.createMany({ data: messagePayloads });
    messageCount += messagePayloads.length;
  }

  console.log(`  Created ${chatTopics.length} chat sessions, ${messageCount} messages`);

  // ── 12. Pending Actions (confirmation queue) ──
  console.log('Creating pending actions...');
  const pendingSession = await prisma.chatSession.findFirst();
  if (pendingSession) {
    await prisma.pendingAction.createMany({
      data: [
        { sessionId: pendingSession.id, userId: admin.id, toolName: 'jira_create', parameters: JSON.stringify({ project: 'TEST', summary: 'Investigate flaky test' }), status: 'APPROVED', resolvedAt: daysAgo(2), resolvedBy: admin.id },
        { sessionId: pendingSession.id, userId: engineer.id, toolName: 'jenkins_trigger_build', parameters: JSON.stringify({ pipeline: 'E2E Suite', branch: 'main' }), status: 'DENIED', resolvedAt: daysAgo(1), resolvedBy: engineer.id },
        { sessionId: pendingSession.id, userId: admin.id, toolName: 'github_merge_pr', parameters: JSON.stringify({ owner: 'org', repo: 'testops', prNumber: 42, method: 'squash' }), status: 'PENDING' },
      ],
    });
  }

  console.log('  Created 3 pending actions');

  // ── 13. Notifications ──
  console.log('Creating notifications...');
  const notifPayloads: Prisma.NotificationCreateManyInput[] = [];
  const notifTypes = ['TEST_FAILED', 'TEST_PASSED', 'PIPELINE_FAILED', 'PIPELINE_PASSED', 'SYSTEM'];
  const notifMessages = [
    'Critical test failure detected in production pipeline',
    'All tests passed successfully',
    'Flaky test detected - investigate intermittent failures',
    'E2E test suite failed - 15 tests failing',
    'Security scan completed - no vulnerabilities found',
    'Performance degradation detected - response time increased by 25%',
    'Database migration failed in staging environment',
    'Visual regression tests passed - UI unchanged',
    'New failure pattern detected: OAuth Timeout Pattern',
    'AI analysis completed for 12 new failures',
  ];

  for (let i = 0; i < 50; i++) {
    const type = pick(notifTypes);
    const user = pick(users);
    const relatedRun = pick(testRuns);

    notifPayloads.push({
      userId: user.id,
      testRunId: relatedRun.id,
      type,
      title: type.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c: string) => c.toUpperCase()),
      message: pick(notifMessages),
      read: Math.random() > 0.4,
      createdAt: daysAgo(randomBetween(0, 14)),
    });
  }

  await prisma.notification.createMany({ data: notifPayloads });
  console.log(`  Created ${notifPayloads.length} notifications`);

  // ── 14. Jira Config + Issues ──
  console.log('Creating Jira integration data...');
  await prisma.jiraConfig.create({
    data: {
      baseUrl: 'https://testops-demo.atlassian.net',
      apiToken: 'demo-api-token-encrypted',
      projectKey: 'TEST',
      defaultType: 'BUG',
    },
  });

  const jiraPayloads: Prisma.JiraIssueCreateManyInput[] = [];
  for (let i = 1; i <= 25; i++) {
    const status = pick(JIRA_STATUSES);
    jiraPayloads.push({
      jiraKey: `TEST-${100 + i}`,
      jiraId: `${10000 + i}`,
      projectKey: 'TEST',
      summary: faker.lorem.sentence(),
      description: faker.lorem.paragraph(),
      issueType: pick(['Bug', 'Task', 'Story']),
      status,
      priority: pick(JIRA_PRIORITIES),
      assignee: faker.person.fullName(),
      reporter: faker.person.fullName(),
      testRunId: pick(testRuns).id,
      failureArchiveId: failures.length > 0 ? pick(failures).id : null,
      metadata: JSON.stringify({ labels: ['test-failure', 'auto-created'], sprint: 'Sprint 7' }),
      createdAt: daysAgo(randomBetween(0, 20)),
    });
  }

  await prisma.jiraIssue.createMany({ data: jiraPayloads });
  console.log(`  Created 1 Jira config, ${jiraPayloads.length} Jira issues`);

  // ── 15. Confluence Pages ──
  console.log('Creating Confluence pages...');
  const confluencePayloads = [
    { pageId: 'conf-001', spaceKey: 'TESTOPS', title: 'Flaky Test Runbook', url: 'https://testops-demo.atlassian.net/wiki/spaces/TESTOPS/pages/001' },
    { pageId: 'conf-002', spaceKey: 'TESTOPS', title: 'RCA: Payment Processing Failures', url: 'https://testops-demo.atlassian.net/wiki/spaces/TESTOPS/pages/002' },
    { pageId: 'conf-003', spaceKey: 'TESTOPS', title: 'CI/CD Pipeline Best Practices', url: 'https://testops-demo.atlassian.net/wiki/spaces/TESTOPS/pages/003' },
    { pageId: 'conf-004', spaceKey: 'ENG', title: 'Test Environment Setup Guide', url: 'https://testops-demo.atlassian.net/wiki/spaces/ENG/pages/004' },
    { pageId: 'conf-005', spaceKey: 'ENG', title: 'Post-Mortem: OAuth Provider Outage', url: 'https://testops-demo.atlassian.net/wiki/spaces/ENG/pages/005' },
  ];

  await prisma.confluencePage.createMany({
    data: confluencePayloads.map((p) => ({
      ...p,
      publishedBy: pick(users).id,
    })),
  });

  console.log(`  Created ${confluencePayloads.length} Confluence pages`);

  // ── 16. TestRail Runs ──
  console.log('Creating TestRail runs...');
  const testRailPayloads: Array<{
    testRailRunId: number;
    projectId: number;
    suiteId: number;
    name: string;
    description: string;
    testRunId: string | null;
  }> = [];
  for (let i = 1; i <= 10; i++) {
    testRailPayloads.push({
      testRailRunId: 1000 + i,
      projectId: 1,
      suiteId: randomBetween(1, 5),
      name: `TestRail Run #${1000 + i}`,
      description: faker.lorem.sentence(),
      testRunId: testRuns[i % testRuns.length]?.id || null,
    });
  }

  await prisma.testRailRun.createMany({ data: testRailPayloads });
  console.log(`  Created ${testRailPayloads.length} TestRail runs`);

  // ── 17. Dashboard Configs ──
  console.log('Creating dashboard configs...');
  await prisma.dashboardConfig.createMany({
    data: [
      {
        userId: admin.id,
        teamId: team.id,
        name: 'Team Overview',
        layout: JSON.stringify({
          widgets: [
            { type: 'failure-trend', position: { x: 0, y: 0, w: 6, h: 3 } },
            { type: 'pipeline-status', position: { x: 6, y: 0, w: 6, h: 3 } },
            { type: 'ai-usage', position: { x: 0, y: 3, w: 4, h: 3 } },
            { type: 'flaky-tests', position: { x: 4, y: 3, w: 8, h: 3 } },
          ],
        }),
        isDefault: true,
      },
      {
        userId: engineer.id,
        teamId: team2.id,
        name: 'QA Metrics',
        layout: JSON.stringify({
          widgets: [
            { type: 'test-results', position: { x: 0, y: 0, w: 12, h: 4 } },
            { type: 'failure-categories', position: { x: 0, y: 4, w: 6, h: 3 } },
            { type: 'recent-failures', position: { x: 6, y: 4, w: 6, h: 3 } },
          ],
        }),
        isDefault: false,
      },
    ],
  });

  console.log('  Created 2 dashboard configs');

  // ── 18. Shared Analyses ──
  console.log('Creating shared analyses...');
  await prisma.sharedAnalysis.createMany({
    data: [
      {
        token: crypto.randomUUID(),
        userId: admin.id,
        title: 'Q1 2026 Test Health Report',
        content: 'Comprehensive analysis of test suite health across all pipelines. Key finding: flaky test rate decreased 40% after implementing retry strategies.',
        persona: 'metrics-analyst',
        toolSummary: JSON.stringify(['dashboard_metrics', 'failure_predictions', 'jira_search']),
        expiresAt: daysAgo(-30),
        viewCount: 12,
      },
      {
        token: crypto.randomUUID(),
        userId: engineer.id,
        title: 'Payment Processing Investigation',
        content: 'Root cause analysis for recurring PaymentProcessor failures. Identified missing null check in cart validation.',
        persona: 'investigator',
        toolSummary: JSON.stringify(['jira_get', 'github_get_commit', 'confluence_search']),
        expiresAt: daysAgo(-14),
        viewCount: 5,
      },
    ],
  });

  console.log('  Created 2 shared analyses');

  // ── 19. Channel User Mappings ──
  console.log('Creating channel user mappings...');
  await prisma.channelUserMapping.createMany({
    data: [
      { channel: 'slack', externalId: 'U0123ADMIN', userId: admin.id, metadata: JSON.stringify({ team: 'T0123', channel: 'C0123-testops' }) },
      { channel: 'slack', externalId: 'U0456ENGR', userId: engineer.id, metadata: JSON.stringify({ team: 'T0123', channel: 'C0123-testops' }) },
      { channel: 'teams', externalId: 'teams-admin-001', userId: admin.id, metadata: JSON.stringify({ tenantId: 'tenant-001' }) },
    ],
  });

  console.log('  Created 3 channel user mappings');

  // ── 20. Self-Healing Rules ──
  console.log('Creating self-healing rules...');

  const healingRules = await Promise.all([
    // Built-in transient rules
    prisma.healingRule.create({
      data: {
        name: 'Connection Timeout Retry',
        description: 'Retries tests that fail due to network connection timeouts',
        pattern: '(ETIMEDOUT|ECONNREFUSED|ECONNRESET|socket hang up)',
        patternType: 'regex',
        category: 'transient',
        action: 'retry',
        maxRetries: 2,
        cooldownMinutes: 30,
        confidenceThreshold: 0.85,
        enabled: true,
        isBuiltIn: true,
        priority: 90,
      },
    }),
    prisma.healingRule.create({
      data: {
        name: 'Database Lock Timeout',
        description: 'Retries tests that fail from database lock contention',
        pattern: '(lock timeout|deadlock detected|database is locked)',
        patternType: 'regex',
        category: 'transient',
        action: 'retry',
        maxRetries: 3,
        cooldownMinutes: 15,
        confidenceThreshold: 0.9,
        enabled: true,
        isBuiltIn: true,
        priority: 85,
      },
    }),
    prisma.healingRule.create({
      data: {
        name: 'Flaky UI Assertion',
        description: 'Quarantines tests with intermittent DOM assertion failures',
        pattern: '(element not found|timeout waiting for|stale element reference)',
        patternType: 'regex',
        category: 'flaky',
        action: 'quarantine',
        maxRetries: 1,
        cooldownMinutes: 120,
        confidenceThreshold: 0.75,
        enabled: true,
        isBuiltIn: true,
        priority: 70,
      },
    }),
    prisma.healingRule.create({
      data: {
        name: 'OOM Kill Recovery',
        description: 'Notifies when tests are killed by OOM',
        pattern: '(out of memory|OOM|heap out of memory|JavaScript heap)',
        patternType: 'regex',
        category: 'infrastructure',
        action: 'notify',
        maxRetries: 0,
        cooldownMinutes: 60,
        confidenceThreshold: 0.95,
        enabled: true,
        isBuiltIn: true,
        priority: 95,
      },
    }),
    // Custom user-created rules
    prisma.healingRule.create({
      data: {
        name: 'Payment Gateway Timeout',
        description: 'Auto-retries checkout tests when payment sandbox is slow',
        pattern: 'payment gateway timeout',
        patternType: 'keyword',
        category: 'transient',
        action: 'retry',
        maxRetries: 2,
        cooldownMinutes: 45,
        confidenceThreshold: 0.8,
        enabled: true,
        isBuiltIn: false,
        priority: 60,
      },
    }),
    prisma.healingRule.create({
      data: {
        name: 'Auth Token Expiry',
        description: 'Suggests fix PR when OAuth token refresh logic fails consistently',
        pattern: '(token expired|401 Unauthorized|JWT malformed)',
        patternType: 'regex',
        category: 'custom',
        action: 'fix_pr',
        maxRetries: 0,
        cooldownMinutes: 240,
        confidenceThreshold: 0.7,
        enabled: true,
        isBuiltIn: false,
        priority: 55,
      },
    }),
    prisma.healingRule.create({
      data: {
        name: 'Rate Limit Backoff',
        description: 'Retries API tests hitting rate limits with exponential backoff',
        pattern: '(429|rate limit|too many requests)',
        patternType: 'regex',
        category: 'transient',
        action: 'retry',
        maxRetries: 3,
        cooldownMinutes: 60,
        confidenceThreshold: 0.88,
        enabled: true,
        isBuiltIn: false,
        priority: 65,
      },
    }),
    prisma.healingRule.create({
      data: {
        name: 'Selenium Grid Saturation',
        description: 'Quarantines UI tests when all grid nodes are occupied',
        pattern: 'no free nodes available',
        patternType: 'keyword',
        category: 'infrastructure',
        action: 'quarantine',
        maxRetries: 0,
        cooldownMinutes: 180,
        confidenceThreshold: 0.92,
        enabled: false,
        isBuiltIn: false,
        priority: 40,
      },
    }),
  ]);

  console.log(`  Created ${healingRules.length} healing rules (${healingRules.filter(r => r.isBuiltIn).length} built-in, ${healingRules.filter(r => !r.isBuiltIn).length} custom)`);

  // ── 21. Healing Events ──
  console.log('Creating healing events...');

  // Get some failed test runs to associate healing events with
  const failedRuns = testRunPayloads.filter(r => r.status === 'FAILED').slice(0, 30);
  const healingEventPayloads: Prisma.HealingEventCreateManyInput[] = [];

  const errorMessages = [
    'ETIMEDOUT: connection timed out after 30000ms',
    'ECONNREFUSED: connect ECONNREFUSED 10.0.0.1:5432',
    'deadlock detected on table "sessions"',
    'element not found: #checkout-button (timeout 15000ms)',
    'timeout waiting for selector "div.payment-form"',
    'JavaScript heap out of memory',
    'payment gateway timeout after 20s',
    'stale element reference: element is not attached to the DOM',
    'Error 429: too many requests — rate limited',
    'ECONNRESET: socket hang up during TLS handshake',
    'JWT malformed: unexpected token at position 0',
    'database is locked (SQLite busy timeout)',
  ];

  const matchReasons = [
    'Matched transient pattern: connection timeout indicates temporary network issue',
    'Matched infrastructure pattern: database lock contention during peak load',
    'Matched flaky pattern: intermittent DOM element timing issue',
    'Matched infrastructure pattern: memory pressure on CI runner',
    'Matched transient pattern: third-party service temporarily unavailable',
    'Matched custom pattern: payment sandbox response delay',
    'Matched flaky pattern: stale element in SPA navigation',
    'Matched transient pattern: API rate limiting during parallel test execution',
    'Matched custom pattern: authentication token lifecycle issue',
  ];

  for (let i = 0; i < Math.min(failedRuns.length, 25); i++) {
    const run = failedRuns[i];
    const rule = healingRules[i % healingRules.length];
    const eventAge = randomBetween(1, DAYS_OF_HISTORY * 24);
    const createdAt = hoursAgo(eventAge);
    const isCompleted = Math.random() > 0.15;
    const succeeded = isCompleted && Math.random() > 0.25;

    healingEventPayloads.push({
      ruleId: rule.id,
      testRunId: run.id!,
      pipelineId: run.pipelineId,
      action: rule.action,
      status: isCompleted ? (succeeded ? 'success' : 'failed') : (Math.random() > 0.5 ? 'executing' : 'pending'),
      matchConfidence: parseFloat((rule.confidenceThreshold + Math.random() * 0.1).toFixed(2)),
      matchReason: matchReasons[i % matchReasons.length],
      errorMessage: errorMessages[i % errorMessages.length],
      retriedRunId: rule.action === 'retry' && succeeded ? (testRunPayloads[randomBetween(0, testRunPayloads.length - 1)]?.id ?? null) : null,
      metadata: JSON.stringify({
        attemptNumber: randomBetween(1, rule.maxRetries || 1),
        executionTimeMs: randomBetween(500, 5000),
        ...(rule.action === 'fix_pr' ? { prUrl: `https://github.com/org/testops-app/pull/${randomBetween(100, 500)}`, branch: `fix/healing-${i}` } : {}),
        ...(rule.action === 'quarantine' ? { flakinessScore: parseFloat((Math.random() * 0.6 + 0.4).toFixed(2)) } : {}),
      }),
      createdAt,
      completedAt: isCompleted ? new Date(createdAt.getTime() + randomBetween(2000, 120000)) : null,
    });
  }

  await prisma.healingEvent.createMany({ data: healingEventPayloads });
  console.log(`  Created ${healingEventPayloads.length} healing events`);

  // ── 22. Quarantined Tests ──
  console.log('Creating quarantined tests...');

  const quarantinedTestData: Prisma.QuarantinedTestCreateManyInput[] = [
    {
      testName: 'CheckoutFlow.test.ts > should complete purchase with saved card',
      reason: 'Intermittent payment gateway timeout (flaky 42% of runs over last 7 days)',
      severity: 'HIGH',
      quarantinedBy: 'auto',
      healingEventId: healingEventPayloads[0] ? undefined : undefined,
      flakinessScore: 0.42,
      occurrenceCount: 18,
      status: 'quarantined',
    },
    {
      testName: 'LoginPage.test.ts > should handle OAuth redirect flow',
      reason: 'Stale element reference during OAuth popup close (DOM timing)',
      severity: 'MEDIUM',
      quarantinedBy: 'auto',
      flakinessScore: 0.31,
      occurrenceCount: 12,
      status: 'quarantined',
    },
    {
      testName: 'DashboardMetrics.test.ts > should render real-time chart updates',
      reason: 'WebSocket connection race condition on CI runners',
      severity: 'MEDIUM',
      quarantinedBy: 'auto',
      flakinessScore: 0.28,
      occurrenceCount: 9,
      status: 'quarantined',
    },
    {
      testName: 'SearchResults.test.ts > should paginate through 1000+ results',
      reason: 'Heap out of memory on GitHub Actions 4GB runner',
      severity: 'CRITICAL',
      quarantinedBy: admin.id,
      flakinessScore: 0.65,
      occurrenceCount: 31,
      status: 'quarantined',
    },
    {
      testName: 'NotificationService.test.ts > should deliver Slack message within SLA',
      reason: 'Slack sandbox rate limiting during parallel test execution',
      severity: 'LOW',
      quarantinedBy: 'auto',
      flakinessScore: 0.15,
      occurrenceCount: 5,
      status: 'quarantined',
    },
    {
      testName: 'UserProfile.test.ts > should upload avatar image',
      reason: 'S3 presigned URL expiration timing (flaky on slow CI)',
      severity: 'MEDIUM',
      quarantinedBy: 'auto',
      flakinessScore: 0.22,
      occurrenceCount: 7,
      status: 'quarantined',
    },
    {
      testName: 'PipelineScheduler.test.ts > should handle concurrent triggers',
      reason: 'Database deadlock on concurrent pipeline creation',
      severity: 'HIGH',
      quarantinedBy: engineer.id,
      flakinessScore: 0.38,
      occurrenceCount: 14,
      status: 'quarantined',
    },
    // Reinstated tests (showing recovery)
    {
      testName: 'APIRateLimit.test.ts > should respect 429 backoff headers',
      reason: 'Fixed: Added exponential backoff retry logic (PR #287)',
      severity: 'LOW',
      quarantinedBy: 'auto',
      flakinessScore: 0.05,
      occurrenceCount: 3,
      status: 'reinstated',
    },
    {
      testName: 'CacheInvalidation.test.ts > should invalidate on config change',
      reason: 'Fixed: Race condition resolved with mutex lock (PR #301)',
      severity: 'MEDIUM',
      quarantinedBy: 'auto',
      flakinessScore: 0.02,
      occurrenceCount: 6,
      status: 'reinstated',
    },
  ];

  await prisma.quarantinedTest.createMany({ data: quarantinedTestData });

  const quarantinedCount = quarantinedTestData.filter(t => t.status === 'quarantined').length;
  const reinstatedCount = quarantinedTestData.filter(t => t.status === 'reinstated').length;
  console.log(`  Created ${quarantinedTestData.length} quarantined tests (${quarantinedCount} active, ${reinstatedCount} reinstated)`);

  // ── 23. Xray Sync Records ──
  console.log('Creating Xray sync records...');

  const recentRuns = testRunPayloads.slice(0, 6);
  const xraySyncPayloads: Prisma.XraySyncCreateManyInput[] = recentRuns.map((run, i) => {
    const isFailed = i === 4; // one failure for realism
    const isSyncing = i === 5; // one in-progress
    const syncedAt = isFailed || isSyncing ? null : hoursAgo(randomBetween(1, 48));
    const status = isFailed ? 'FAILED' : isSyncing ? 'SYNCING' : 'SYNCED';

    return {
      testRunId: run.id!,
      xrayExecutionId: status === 'SYNCED' ? `PROJ-EX-${200 + i}` : null,
      projectKey: 'PROJ',
      status,
      resultCount: status === 'SYNCED' ? randomBetween(8, 50) : 0,
      errorMessage: isFailed ? 'Authentication failed (HTTP 401)' : null,
      syncedAt,
      createdAt: hoursAgo(randomBetween(2, 72)),
    };
  });

  await prisma.xraySync.createMany({ data: xraySyncPayloads });
  console.log(`  Created ${xraySyncPayloads.length} Xray sync records`);

  // ── Summary ──
  const summary = {
    users: users.length,
    teams: 2,
    pipelines: pipelines.length,
    testRuns: testRunPayloads.length,
    testResults: testResultPayloads.length,
    failureArchives: failurePayloads.length,
    rcaRevisions: rcaPayloads.length,
    failureComments: commentPayloads.length,
    failurePatterns: patternPayloads.length,
    aiUsageRecords: aiUsageCount,
    chatSessions: chatTopics.length,
    chatMessages: messageCount,
    pendingActions: 3,
    notifications: notifPayloads.length,
    jiraIssues: jiraPayloads.length,
    confluencePages: confluencePayloads.length,
    testRailRuns: testRailPayloads.length,
    dashboardConfigs: 2,
    sharedAnalyses: 2,
    channelMappings: 3,
    healingRules: healingRules.length,
    healingEvents: healingEventPayloads.length,
    quarantinedTests: quarantinedTestData.length,
    xraySyncs: xraySyncPayloads.length,
  };

  const totalDataPoints = Object.values(summary).reduce((a, b) => a + b, 0);

  console.log('\n=== Database seeded with high-fidelity demo data ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nTotal data points: ${totalDataPoints}`);
  console.log('All models seeded. Dashboards, metrics, and AI features are ready for demo.\n');

  return summary;
}

// ── Entry Point ──

seed()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

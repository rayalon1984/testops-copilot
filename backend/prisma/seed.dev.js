/**
 * Development Seed Data for Demo Mode - ENHANCED
 * Creates massive realistic test failures and AI analysis data for impressive demos
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

// Dramatically increased counts for demo impact - ALL 6 CATEGORIES
const FAILURE_CATEGORIES = {
  bug_critical: { severity: 'CRITICAL', count: 280 },
  bug_minor: { severity: 'MEDIUM', count: 420 },
  environment: { severity: 'HIGH', count: 190 },
  flaky: { severity: 'LOW', count: 315 },
  configuration: { severity: 'MEDIUM', count: 245 },
  unknown: { severity: 'MEDIUM', count: 150 }, // NEW: For unclassified failures
};

const SAMPLE_FAILURES = [
  {
    testName: 'PaymentProcessor.processCheckout',
    errorType: 'NullPointerException',
    errorMessage: 'Cannot read property "total" of null in payment calculation',
    stackTrace: `at PaymentService.calculateTotal (src/services/payment.ts:142:28)\nat CheckoutController.processOrder (src/controllers/checkout.ts:89:15)\nat async processCheckout (src/handlers/payment.ts:56:12)`,
    rootCause: 'Missing null check when cart items array is empty',
    solution: 'Add validation to check if cart.items exists and has length > 0 before processing',
    preventionSteps: 'Add unit tests for edge cases including empty carts',
  },
  {
    testName: 'AuthenticationFlow.loginWithOAuth',
    errorType: 'TimeoutException',
    errorMessage: 'OAuth provider did not respond within 5000ms',
    stackTrace: `at OAuthClient.exchangeToken (src/auth/oauth.ts:234:19)\nat AuthController.handleCallback (src/controllers/auth.ts:167:22)\nat Router.handle (express/lib/router/index.js:281:14)`,
    rootCause: 'Network latency to third-party OAuth provider exceeds timeout threshold',
    solution: 'Increase timeout to 10s and add retry logic with exponential backoff',
    preventionSteps: 'Mock OAuth calls in tests, add monitoring for provider response times',
  },
  {
    testName: 'UserRegistration.validateEmail',
    errorType: 'ValidationError',
    errorMessage: 'Email format validation failed for user@subdomain.domain.com',
    stackTrace: `at EmailValidator.validate (src/utils/validators.ts:45:11)\nat UserService.register (src/services/user.ts:78:23)\nat RegistrationController.create (src/controllers/registration.ts:34:18)`,
    rootCause: 'Regex pattern too strict - rejects valid emails with subdomains',
    solution: 'Update email validation regex to support all valid RFC 5322 formats',
    preventionSteps: 'Use well-tested email validation library like validator.js instead of custom regex',
  },
  {
    testName: 'DataSync.syncUserProfiles',
    errorType: 'ConcurrencyException',
    errorMessage: 'Database deadlock detected during batch update operation',
    stackTrace: `at DatabaseClient.executeBatch (src/db/client.ts:189:15)\nat SyncService.updateProfiles (src/services/sync.ts:92:20)\nat CronJob.run (src/jobs/sync.ts:45:12)`,
    rootCause: 'Multiple sync jobs running simultaneously causing row-level locks',
    solution: 'Implement distributed lock using Redis before starting sync',
    preventionSteps: 'Add job queue with single-worker constraint for sync operations',
  },
  {
    testName: 'SearchAPI.queryProducts',
    errorType: 'AssertionError',
    errorMessage: 'Expected 10 results but got 9 - test data inconsistency',
    stackTrace: `at Object.<anonymous> (tests/api/search.test.ts:67:8)\nat Promise.then.completed (jest-circus/build/utils.js:293:28)\nat new Promise (<anonymous>)`,
    rootCause: 'Test data includes a product that was soft-deleted, reducing result count',
    solution: 'Update test to filter out soft-deleted items or use stable test fixtures',
    preventionSteps: 'Use transaction-based test isolation to prevent data pollution between tests',
  },
  {
    testName: 'ConfigLoader.loadDatabaseSettings',
    errorType: 'ConfigurationError',
    errorMessage: 'Missing required environment variable: DB_POOL_SIZE',
    stackTrace: `at ConfigService.validate (src/config/service.ts:123:13)\nat ConfigService.load (src/config/service.ts:56:10)\nat Application.bootstrap (src/app.ts:29:22)`,
    rootCause: 'Environment variable not set in staging deployment configuration',
    solution: 'Add DB_POOL_SIZE=20 to staging environment variables',
    preventionSteps: 'Add env var validation at app startup with clear error messages',
  },
  {
    testName: 'FileUpload.processImage',
    errorType: 'OutOfMemoryError',
    errorMessage: 'Heap out of memory during image processing - 50MB file exceeded limits',
    stackTrace: `at ImageProcessor.resize (src/media/processor.ts:78:15)\nat UploadController.handleFile (src/controllers/upload.ts:45:19)\nat Multer.handle (multer/index.js:142:10)`,
    rootCause: 'Loading entire 50MB image into memory before processing',
    solution: 'Use streaming image processing with sharp library',
    preventionSteps: 'Add file size limits and process images in chunks with stream API',
  },
  {
    testName: 'NotificationService.sendEmail',
    errorType: 'NetworkError',
    errorMessage: 'SMTP connection refused on port 587',
    stackTrace: `at SMTPClient.connect (nodemailer/lib/smtp-connection/index.js:389:17)\nat EmailService.send (src/services/email.ts:156:12)\nat NotificationQueue.process (src/queues/notification.ts:67:8)`,
    rootCause: 'Firewall blocking outbound SMTP on test environment',
    solution: 'Update firewall rules or use environment-specific SMTP relay',
    preventionSteps: 'Mock email service in tests, add smoke tests for SMTP connectivity',
  },
  {
    testName: 'ShoppingCart.calculateTax',
    errorType: 'ArithmeticException',
    errorMessage: 'Division by zero in tax calculation for international orders',
    stackTrace: `at TaxService.calculate (src/services/tax.ts:89:24)\nat CartService.getTotal (src/services/cart.ts:156:18)\nat CheckoutController.summary (src/controllers/checkout.ts:42:11)`,
    rootCause: 'Missing tax rate configuration for newly added country code',
    solution: 'Add default tax rate fallback and validation for supported countries',
    preventionSteps: 'Implement comprehensive country/tax rate validation at cart creation',
  },
  {
    testName: 'WebSocket.handleConnection',
    errorType: 'ConnectionError',
    errorMessage: 'WebSocket connection dropped after 30 seconds',
    stackTrace: `at WebSocketServer.onConnection (src/websocket/server.ts:234:15)\nat Socket.emit (events.js:315:20)\nat emitCloseNT (net.js:1670:8)`,
    rootCause: 'Load balancer timeout shorter than application keepalive interval',
    solution: 'Reduce WebSocket ping interval to 20s and configure LB timeout to 60s',
    preventionSteps: 'Add automated tests for long-lived WebSocket connections',
  },
  {
    testName: 'ThirdPartyAPI.fetchUserData',
    errorType: 'UnknownError',
    errorMessage: 'Unexpected response format from external API - unable to parse',
    stackTrace: `at APIClient.parseResponse (src/integrations/api-client.ts:198:11)\nat ThirdPartyService.getUserInfo (src/services/third-party.ts:89:20)\nat UserController.syncExternalData (src/controllers/user.ts:156:14)`,
    rootCause: 'External API changed response schema without notice',
    solution: 'Add response validation and fallback handling for schema mismatches',
    preventionSteps: 'Implement contract testing with external API providers',
  },
  {
    testName: 'ReportGenerator.createPDF',
    errorType: 'UnknownError',
    errorMessage: 'Phantom process exited with code 139 (SIGSEGV)',
    stackTrace: `at ChildProcess.exithandler (child_process.js:290:12)\nat ChildProcess.emit (events.js:315:20)\nat Process.ChildProcess._handle.onexit (internal/child_process.js:275:12)`,
    rootCause: 'Segmentation fault in headless browser - cause unclear',
    solution: 'Update to latest Chrome driver, add memory limits, enable crash reporting',
    preventionSteps: 'Monitor crash reports, add health checks for browser processes',
  },
  {
    testName: 'CacheService.retrieve',
    errorType: 'UnknownError',
    errorMessage: 'Redis connection intermittently returns READONLY - replica mode unexpected',
    stackTrace: `at RedisClient.handleReply (redis/lib/parser/javascript.js:68:14)\nat CacheService.get (src/services/cache.ts:134:19)\nat middleware/cache.ts:45:12`,
    rootCause: 'Redis failover causing temporary readonly state - root cause under investigation',
    solution: 'Add retry logic with exponential backoff, investigate Redis cluster health',
    preventionSteps: 'Set up Redis monitoring, add alerts for failover events',
  },
];

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

const AI_PROVIDERS = [
  { name: 'anthropic', model: 'claude-opus-4-6', avgTokens: 1200, avgCost: 0.108, avgTime: 1800 },
  { name: 'openai', model: 'gpt-4.1', avgTokens: 1500, avgCost: 0.06, avgTime: 2100 },
  { name: 'google', model: 'gemini-3.0-flash', avgTokens: 1100, avgCost: 0.000825, avgTime: 1200 },
  { name: 'openrouter', model: 'meta-llama/llama-4-maverick', avgTokens: 1300, avgCost: 0.003, avgTime: 1500 },
];

const NOTIFICATION_TEMPLATES = [
  { type: 'failure', message: 'Critical test failure detected in production pipeline' },
  { type: 'success', message: 'All tests passed successfully' },
  { type: 'warning', message: 'Flaky test detected - investigate intermittent failures' },
  { type: 'failure', message: 'E2E test suite failed - 15 tests failing' },
  { type: 'success', message: 'Security scan completed - no vulnerabilities found' },
  { type: 'warning', message: 'Performance degradation detected - response time increased by 25%' },
  { type: 'failure', message: 'Database migration failed in staging environment' },
  { type: 'success', message: 'Visual regression tests passed - UI unchanged' },
];

async function seedDevelopmentData() {
  console.log('🌱 Seeding development database with MASSIVE demo data...');

  // Clear existing data
  await prisma.aIUsage.deleteMany();
  await prisma.failureArchive.deleteMany();
  await prisma.testRun.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.user.deleteMany();

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: 'demo@testops.ai',
      password: '$2b$10$183iH8FvV2oWLI7Jolw8Lemvylrt00/7FnjznnkWbOf3C7WAtShTu', // bcrypt hash for 'demo123'
      firstName: 'Demo',
      lastName: 'User',
      role: 'ADMIN',
    },
  });

  console.log('✅ Created demo user');

  // Create pipelines with realistic data
  const pipelines = [];
  for (const template of PIPELINE_TEMPLATES) {
    const pipeline = await prisma.pipeline.create({
      data: {
        name: template.name,
        type: template.type,
        status: Math.random() > 0.7 ? 'PENDING' : Math.random() > 0.5 ? 'RUNNING' : 'COMPLETED',
        config: JSON.stringify({
          repo: `testops-${template.name.toLowerCase().replace(/\s+/g, '-')}`,
          branch: 'main',
          triggers: ['push', 'pull_request'],
          notifications: { email: true, slack: true }
        }),
        // userId: admin.id, // Removed for Prod schema alignment
        description: template.description,
      },
    });
    pipelines.push(pipeline);
  }

  console.log(`✅ Created ${pipelines.length} pipelines`);

  // Create MANY test runs with variety
  // Create MANY test runs with variety - BATCHED
  console.log('Generating test runs...');
  const testRunPayloads = [];
  for (let i = 0; i < 150; i++) {
    const pipeline = pipelines[i % pipelines.length];
    const hoursAgo = Math.floor(Math.random() * 720); // Up to 30 days ago
    const startTime = new Date(now - hoursAgo * 3600000);
    const duration = 600 + Math.floor(Math.random() * 2400); // 10-50 minutes
    const endTime = new Date(startTime.getTime() + duration * 1000);

    const passed = Math.floor(Math.random() * 500) + 200;
    const failed = Math.random() > 0.7 ? Math.floor(Math.random() * 50) : 0;
    const status = failed > 0 ? 'FAILED' : 'PASSED';

    testRunPayloads.push({
      id: crypto.randomUUID(), // SQLite needs manual ID sometimes for relations, but here just creating
      pipelineId: pipeline.id,
      name: `${pipeline.name} - Run #${i + 1}`,
      status,
      branch: Math.random() > 0.7 ? 'main' : Math.random() > 0.5 ? 'develop' : `feature/test-${i}`,
      commit: `${Math.random().toString(36).substring(2, 9)}`,
      startedAt: startTime,
      completedAt: endTime,
      duration,
    });
  }
  await prisma.testRun.createMany({ data: testRunPayloads });
  const testRuns = await prisma.testRun.findMany(); // Re-fetch to have IDs if needed


  console.log(`✅ Created ${testRuns.length} test runs`);

  // Create massive failure dataset
  // Create massive failure dataset - BATCHED
  console.log('Generating failure archives...');
  const failurePayloads = [];
  for (const [category, config] of Object.entries(FAILURE_CATEGORIES)) {
    for (let i = 0; i < config.count; i++) {
      const template = SAMPLE_FAILURES[Math.floor(Math.random() * SAMPLE_FAILURES.length)];
      const daysAgo = Math.floor(Math.random() * 60);
      const occurredAt = new Date(now - daysAgo * 86400000);

      failurePayloads.push({
        testName: `${template.testName}_${category}_${i}`,
        errorMessage: template.errorMessage,
        category: template.errorType,
        stackTrace: template.stackTrace,
        rootCause: template.rootCause,
        solution: template.solution,
        prevention: template.preventionSteps,
        severity: config.severity,
        occurrenceCount: Math.floor(Math.random() * 25) + 1,
        firstOccurrence: new Date(occurredAt.getTime() - Math.random() * 14 * 86400000),
        lastOccurrence: occurredAt,
        rcaDocumented: Math.random() > 0.5,
        resolved: Math.random() > 0.7,
      });
    }
  }
  await prisma.failureArchive.createMany({ data: failurePayloads });
  const failures = failurePayloads; // Just for summary count


  console.log(`✅ Created ${failures.length} test failures across all categories`);

  // Create extensive AI usage data - BATCHED for SQLite performance
  const aiUsages = [];
  const BATCH_SIZE = 500;
  let currentBatch = [];

  console.log('🤖 Generating AI usage records (batched)...');

  for (let day = 0; day < 60; day++) {
    for (const provider of AI_PROVIDERS) {
      const callsPerDay = Math.floor(Math.random() * 120) + 40;
      for (let call = 0; call < callsPerDay; call++) {
        const cacheHit = Math.random() > 0.35; // 65% cache hit rate

        currentBatch.push({
          provider: provider.name,
          model: provider.model,
          tokens: cacheHit ? 0 : provider.avgTokens + Math.floor(Math.random() * 400) - 200,
          cost: cacheHit ? 0 : provider.avgCost * (0.7 + Math.random() * 0.6),
          cacheHit,
          responseTimeMs: cacheHit ? 50 + Math.floor(Math.random() * 150) : provider.avgTime + Math.floor(Math.random() * 800) - 400,
          createdAt: new Date(now - day * 86400000 - Math.random() * 86400000),
        });

        if (currentBatch.length >= BATCH_SIZE) {
          await prisma.aIUsage.createMany({ data: currentBatch });
          aiUsages.push(...currentBatch); // Keep track for summary
          currentBatch = [];
          process.stdout.write('.'); // Progress indicator
        }
      }
    }
  }

  // Insert remaining
  if (currentBatch.length > 0) {
    await prisma.aIUsage.createMany({ data: currentBatch });
    aiUsages.push(...currentBatch);
  }
  console.log(''); // New line after dots

  console.log(`✅ Created ${aiUsages.length} AI usage records`);

  // Summary
  const summary = {
    users: 1,
    pipelines: pipelines.length,
    testRuns: testRuns.length,
    failures: failures.length,
    aiUsages: aiUsages.length,
    categories: Object.keys(FAILURE_CATEGORIES).length,
    avgFailuresPerCategory: Math.floor(failures.length / Object.keys(FAILURE_CATEGORIES).length),
    totalDataPoints: pipelines.length + testRuns.length + failures.length + aiUsages.length,
  };

  console.log('\n📊 Database seeded successfully with MASSIVE demo data!');
  console.log('═══════════════════════════════════════════════════════');
  console.log(JSON.stringify(summary, null, 2));
  console.log('═══════════════════════════════════════════════════════');
  console.log(`\n💡 Demo Stats:`);
  console.log(`   • ${summary.pipelines} realistic pipelines`);
  console.log(`   • ${summary.testRuns} test runs (past 30 days)`);
  console.log(`   • ${summary.failures} analyzed failures`);
  console.log(`   • ${summary.aiUsages} AI API calls`);
  console.log(`   • ${summary.totalDataPoints} total data points\n`);

  return summary;
}

seedDevelopmentData()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

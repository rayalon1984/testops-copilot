/**
 * Development Seed Data for Demo Mode
 * Creates realistic test failures and AI analysis data for dashboard demo
 */

// Use require for better compatibility with ts-node
const { PrismaClient } = require('../node_modules/.prisma/client-dev');

const prisma = new PrismaClient();

const FAILURE_CATEGORIES = {
  bug_critical: { severity: 'CRITICAL', count: 45 },
  bug_minor: { severity: 'MEDIUM', count: 38 },
  environment: { severity: 'HIGH', count: 28 },
  flaky: { severity: 'LOW', count: 22 },
  configuration: { severity: 'MEDIUM', count: 17 },
};

const SAMPLE_FAILURES = [
  {
    testName: 'PaymentProcessor.processCheckout',
    errorType: 'NullPointerException',
    errorMessage: 'Cannot read property "total" of null in payment calculation',
    stackTrace: `at PaymentService.calculateTotal (src/services/payment.ts:142:28)
at CheckoutController.processOrder (src/controllers/checkout.ts:89:15)
at async processCheckout (src/handlers/payment.ts:56:12)`,
    rootCause: 'Missing null check when cart items array is empty',
    solution: 'Add validation to check if cart.items exists and has length > 0 before processing',
    preventionSteps: 'Add unit tests for edge cases including empty carts',
    severity: 'CRITICAL',
    category: 'bug_critical',
  },
  {
    testName: 'AuthenticationFlow.loginWithOAuth',
    errorType: 'TimeoutException',
    errorMessage: 'OAuth provider did not respond within 5000ms',
    stackTrace: `at OAuthClient.exchangeToken (src/auth/oauth.ts:234:19)
at AuthController.handleCallback (src/controllers/auth.ts:167:22)
at Router.handle (express/lib/router/index.js:281:14)`,
    rootCause: 'Network latency to third-party OAuth provider',
    solution: 'Increase timeout to 10s and add retry logic with exponential backoff',
    preventionSteps: 'Mock OAuth calls in tests, add monitoring for provider response times',
    severity: 'HIGH',
    category: 'environment',
  },
  {
    testName: 'UserRegistration.validateEmail',
    errorType: 'ValidationError',
    errorMessage: 'Email format validation failed for user@domain',
    stackTrace: `at EmailValidator.validate (src/utils/validators.ts:45:11)
at UserService.register (src/services/user.ts:78:23)
at RegistrationController.create (src/controllers/registration.ts:34:18)`,
    rootCause: 'Regex pattern too strict - rejects valid emails with subdomains',
    solution: 'Update email validation regex to support all valid RFC 5322 formats',
    preventionSteps: 'Use well-tested email validation library instead of custom regex',
    severity: 'MEDIUM',
    category: 'bug_minor',
  },
  {
    testName: 'DataSync.syncUserProfiles',
    errorType: 'ConcurrencyException',
    errorMessage: 'Database deadlock detected during batch update',
    stackTrace: `at DatabaseClient.executeBatch (src/db/client.ts:189:15)
at SyncService.updateProfiles (src/services/sync.ts:92:20)
at CronJob.run (src/jobs/sync.ts:45:12)`,
    rootCause: 'Multiple sync jobs running simultaneously causing row locks',
    solution: 'Implement distributed lock using Redis before starting sync',
    preventionSteps: 'Add job queue with single-worker constraint for sync operations',
    severity: 'HIGH',
    category: 'bug_critical',
  },
  {
    testName: 'SearchAPI.queryProducts',
    errorType: 'AssertionError',
    errorMessage: 'Expected 10 results but got 9',
    stackTrace: `at Object.<anonymous> (tests/api/search.test.ts:67:8)
at Promise.then.completed (jest-circus/build/utils.js:293:28)
at new Promise (<anonymous>)`,
    rootCause: 'Test data includes a product that was soft-deleted, reducing result count',
    solution: 'Update test to filter out soft-deleted items or use stable test fixtures',
    preventionSteps: 'Use transaction-based test isolation to prevent data pollution',
    severity: 'LOW',
    category: 'flaky',
  },
  {
    testName: 'ConfigLoader.loadDatabaseSettings',
    errorType: 'ConfigurationError',
    errorMessage: 'Missing required environment variable: DB_POOL_SIZE',
    stackTrace: `at ConfigService.validate (src/config/service.ts:123:13)
at ConfigService.load (src/config/service.ts:56:10)
at Application.bootstrap (src/app.ts:29:22)`,
    rootCause: 'Environment variable not set in staging deployment',
    solution: 'Add DB_POOL_SIZE=20 to staging environment variables',
    preventionSteps: 'Add env var validation at app startup with clear error messages',
    severity: 'MEDIUM',
    category: 'configuration',
  },
  {
    testName: 'FileUpload.processImage',
    errorType: 'OutOfMemoryError',
    errorMessage: 'Heap out of memory during image processing',
    stackTrace: `at ImageProcessor.resize (src/media/processor.ts:78:15)
at UploadController.handleFile (src/controllers/upload.ts:45:19)
at Multer.handle (multer/index.js:142:10)`,
    rootCause: 'Loading entire 50MB image into memory before processing',
    solution: 'Use streaming image processing with sharp library',
    preventionSteps: 'Add file size limits and process images in chunks',
    severity: 'CRITICAL',
    category: 'bug_critical',
  },
  {
    testName: 'NotificationService.sendEmail',
    errorType: 'NetworkError',
    errorMessage: 'SMTP connection refused on port 587',
    stackTrace: `at SMTPClient.connect (nodemailer/lib/smtp-connection/index.js:389:17)
at EmailService.send (src/services/email.ts:156:12)
at NotificationQueue.process (src/queues/notification.ts:67:8)`,
    rootCause: 'Firewall blocking outbound SMTP on test environment',
    solution: 'Update firewall rules or use environment-specific SMTP relay',
    preventionSteps: 'Mock email service in tests, add smoke tests for SMTP connectivity',
    severity: 'HIGH',
    category: 'environment',
  },
];

const AI_PROVIDERS = [
  { name: 'anthropic', model: 'claude-sonnet-4', avgTokens: 1200, avgCost: 0.0036, avgTime: 1800 },
  { name: 'openai', model: 'gpt-4-turbo', avgTokens: 1500, avgCost: 0.045, avgTime: 2100 },
  { name: 'google', model: 'gemini-1.5-flash', avgTokens: 1100, avgCost: 0.00055, avgTime: 1200 },
];

async function seedDevelopmentData() {
  console.log('🌱 Seeding development database with demo data...');

  // Clear existing data
  await prisma.aIUsage.deleteMany();
  await prisma.failureArchive.deleteMany();
  await prisma.testRun.deleteMany();
  await prisma.user.deleteMany();

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: 'demo@testops.ai',
      firstName: 'Demo',
      lastName: 'User',
      role: 'ADMIN',
    },
  });

  console.log('✅ Created demo user');

  // Create test runs
  const testRuns = [];
  for (let i = 0; i < 20; i++) {
    const run = await prisma.testRun.create({
      data: {
        name: `Test Run #${i + 1}`,
        status: i < 15 ? 'SUCCESS' : 'FAILURE',
        branch: i % 3 === 0 ? 'main' : i % 3 === 1 ? 'develop' : `feature/test-${i}`,
        commit: `abc${i.toString().padStart(4, '0')}`,
        startTime: new Date(Date.now() - (20 - i) * 3600000),
        endTime: new Date(Date.now() - (20 - i) * 3600000 + 1800000),
        duration: 1800 + Math.floor(Math.random() * 600),
      },
    });
    testRuns.push(run);
  }

  console.log(`✅ Created ${testRuns.length} test runs`);

  // Create diverse test failures
  const failures = [];
  const now = Date.now();

  for (const [category, config] of Object.entries(FAILURE_CATEGORIES)) {
    for (let i = 0; i < config.count; i++) {
      const template = SAMPLE_FAILURES[Math.floor(Math.random() * SAMPLE_FAILURES.length)];
      const daysAgo = Math.floor(Math.random() * 30);
      const occurredAt = new Date(now - daysAgo * 86400000);

      const failure = await prisma.failureArchive.create({
        data: {
          testRunId: testRuns[Math.floor(Math.random() * testRuns.length)].id,
          testName: `${template.testName}_${category}_${i}`,
          failureSignature: `${category}_${template.errorType}_${i}`,
          errorMessage: template.errorMessage,
          errorType: template.errorType,
          stackTrace: template.stackTrace,
          logSnippet: `[ERROR] ${template.errorMessage}`,
          occurredAt,
          environment: ['production', 'staging', 'development'][Math.floor(Math.random() * 3)],
          buildNumber: `${Math.floor(Math.random() * 1000)}`,
          commitSha: `abc${Math.floor(Math.random() * 10000)}`,
          branch: ['main', 'develop', 'feature/xyz'][Math.floor(Math.random() * 3)],
          rootCause: template.rootCause,
          detailedAnalysis: `AI Analysis: ${template.rootCause}. This failure has been observed ${Math.floor(Math.random() * 5) + 1} times in similar contexts.`,
          solution: template.solution,
          preventionSteps: template.preventionSteps,
          workaround: i % 3 === 0 ? 'Restart the service and retry' : null,
          status: ['NEW', 'INVESTIGATING', 'DOCUMENTED', 'RESOLVED'][Math.floor(Math.random() * 4)],
          severity: config.severity,
          isRecurring: Math.random() > 0.7,
          occurrenceCount: Math.floor(Math.random() * 10) + 1,
          isKnownIssue: Math.random() > 0.8,
          firstSeenAt: new Date(occurredAt.getTime() - Math.random() * 7 * 86400000),
          lastSeenAt: occurredAt,
        },
      });
      failures.push(failure);
    }
  }

  console.log(`✅ Created ${failures.length} test failures across all categories`);

  // Create AI usage data
  const aiUsages = [];
  for (let day = 0; day < 30; day++) {
    for (const provider of AI_PROVIDERS) {
      const callsPerDay = Math.floor(Math.random() * 50) + 20;
      for (let call = 0; call < callsPerDay; call++) {
        const cacheHit = Math.random() > 0.35; // 65% cache hit rate
        const usage = await prisma.aIUsage.create({
          data: {
            provider: provider.name,
            model: provider.model,
            tokens: cacheHit ? 0 : provider.avgTokens + Math.floor(Math.random() * 200) - 100,
            cost: cacheHit ? 0 : provider.avgCost * (0.8 + Math.random() * 0.4),
            cacheHit,
            responseTimeMs: cacheHit ? 50 + Math.floor(Math.random() * 100) : provider.avgTime + Math.floor(Math.random() * 500) - 250,
            createdAt: new Date(now - day * 86400000 - Math.random() * 86400000),
          },
        });
        aiUsages.push(usage);
      }
    }
  }

  console.log(`✅ Created ${aiUsages.length} AI usage records`);

  // Summary
  const summary = {
    users: 1,
    testRuns: testRuns.length,
    failures: failures.length,
    aiUsages: aiUsages.length,
    categories: Object.keys(FAILURE_CATEGORIES).length,
  };

  console.log('\n📊 Database seeded successfully!');
  console.log('Summary:', JSON.stringify(summary, null, 2));

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

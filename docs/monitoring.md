# Monitoring and Logging Guide

## Overview

This guide covers monitoring, logging, and observability practices for TestOps Copilot.

## Grafana & Prometheus Integration

TestOps Copilot includes a **built-in Grafana and Prometheus integration** for comprehensive test metrics visualization and monitoring.

### Quick Start

For complete setup instructions, see the [Grafana Integration Guide](integrations/grafana.md).

**Key Features:**
- Pre-built Grafana dashboard with 7 visualization panels
- Prometheus metrics endpoint at `/metrics`
- 20+ test metrics automatically exposed
- Real-time monitoring of test health and performance
- Custom alerting for failure rate spikes

### Metrics Endpoint

TestOps Copilot exposes test metrics in Prometheus format:

```bash
# Prometheus metrics endpoint
curl http://localhost:3000/metrics
```

**Available Metrics:**
- `testops_test_runs_total` - Total number of test runs
- `testops_pass_rate_percent` - Current pass rate (0-100%)
- `testops_failed_tests_total` - Total failed tests
- `testops_flaky_tests_total` - Total flaky tests
- `testops_execution_time_p50_seconds` - 50th percentile execution time
- `testops_execution_time_p95_seconds` - 95th percentile execution time
- `testops_execution_time_p99_seconds` - 99th percentile execution time
- `testops_rca_coverage_percent` - RCA documentation coverage
- `testops_test_failures_count{test_name="..."}` - Per-test failure counts
- And more... See [full metrics list](integrations/grafana.md#available-metrics)

### JSON API Endpoints

In addition to Prometheus format, TestOps Copilot provides JSON endpoints:

```bash
# Get metrics summary
curl http://localhost:3000/api/v1/metrics/summary

# Get top failing tests
curl http://localhost:3000/api/v1/metrics/top-failures

# Health check
curl http://localhost:3000/api/v1/metrics/health
```

### Pre-built Dashboard

Import the pre-built Grafana dashboard from `grafana-dashboards/testops-overview.json`:

**Dashboard Panels:**
1. Total Test Runs (stat with trend)
2. Pass Rate Gauge (0-100% with thresholds)
3. Test Runs Over Time (passed vs failed trends)
4. Failures Archived (knowledge base size)
5. RCA Coverage (documentation percentage)
6. Top Failing Tests (pie chart breakdown)
7. Execution Time Percentiles (P50, P95, P99)

See [complete Grafana setup guide](integrations/grafana.md).

---

## Additional Monitoring Tools

Beyond the built-in Grafana integration, you can enhance monitoring with:

- **Sentry** for error tracking
- **Winston** for application logging (already integrated)
- **New Relic** for APM (optional)

## Monitoring Stack

## Application Metrics

### Built-in Test Metrics

TestOps Copilot automatically collects and exposes test-related metrics via the **MetricsService** (`backend/src/services/metrics.service.ts`):

```typescript
// Automatically collected metrics
export interface TestMetrics {
  totalTestRuns: number;
  passedTestRuns: number;
  failedTestRuns: number;
  flakyTestRuns: number;
  avgExecutionTime: number;
  p50ExecutionTime: number;
  p95ExecutionTime: number;
  p99ExecutionTime: number;
  passRate: number;
  failureRate: number;
  flakyTestRate: number;
  totalFailuresArchived: number;
  documentedRCAs: number;
  rcaCoverageRate: number;
  // ... and more
}
```

### Metrics Service Implementation

The MetricsService collects data from the Prisma database:

```typescript
// backend/src/services/metrics.service.ts
export class MetricsService {
  // Collect global metrics
  static async getGlobalMetrics(timeRange?: MetricsTimeRange): Promise<TestMetrics>

  // Export in Prometheus format
  static async exportPrometheusMetrics(options: PrometheusExportOptions): Promise<string>

  // Get top failing tests
  static async getTopFailingTests(limit: number = 10): Promise<FailureMetric[]>
}
```

### Metrics Controller

Access metrics via REST API (`backend/src/controllers/metrics.controller.ts`):

```typescript
// GET /metrics - Prometheus format
MetricsController.getPrometheusMetrics()

// GET /api/v1/metrics/summary - JSON format
MetricsController.getMetricsSummary()

// GET /api/v1/metrics/top-failures - Top failing tests
MetricsController.getTopFailures()

// GET /api/v1/metrics/health - Health check
MetricsController.getHealth()
```

### Custom Metrics (Optional)

You can extend the metrics system with custom application metrics:

```typescript
// Example: Custom API metrics
const apiMetrics = {
  requestDuration: new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code']
  }),
  requestTotal: new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
  })
};
```

## Logging

### Log Levels

1. ERROR: Application errors
2. WARN: Warning conditions
3. INFO: General information
4. HTTP: HTTP request logs
5. DEBUG: Debug information

### Logger Configuration

```typescript
// backend/src/utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: config.log.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
});
```

### Structured Logging

```typescript
// Good logging practice
logger.info('Pipeline execution completed', {
  pipelineId: pipeline.id,
  duration: duration,
  status: status,
  testCount: results.total,
  failedTests: results.failed
});

// Bad logging practice
console.log(`Pipeline ${pipelineId} completed in ${duration}ms`);
```

## Error Tracking

### Sentry Integration

```typescript
// backend/src/config/sentry.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: config.monitoring.sentryDsn,
  environment: config.env,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({ app }),
  ],
  tracesSampleRate: 1.0,
});

// Error handler middleware
app.use(Sentry.Handlers.errorHandler());
```

### Error Context

```typescript
try {
  await pipeline.execute();
} catch (error) {
  Sentry.withScope(scope => {
    scope.setExtra('pipelineId', pipeline.id);
    scope.setExtra('configuration', pipeline.config);
    scope.setTag('pipelineType', pipeline.type);
    Sentry.captureException(error);
  });
  throw error;
}
```

## Performance Monitoring

### APM Configuration

```typescript
// backend/src/config/apm.ts
import newrelic from 'newrelic';

newrelic.instrumentLoadedModule(
  'express',
  expressModule => expressModule
);

// Custom transaction
newrelic.startBackgroundTransaction('pipeline-execution', async () => {
  try {
    await executePipeline();
  } finally {
    newrelic.endTransaction();
  }
});
```

### Custom Metrics

```typescript
// Record custom metrics
newrelic.recordMetric('Custom/Pipeline/ExecutionTime', duration);
newrelic.recordMetric('Custom/Tests/FlakyCount', flakyTests.length);
```

## Alerting

### Pre-configured Alert Examples

TestOps Copilot documentation includes alert examples for common scenarios. See [Grafana integration guide - Alerting](integrations/grafana.md#alerting-configuration).

**Example Alerts:**

1. **High Failure Rate Alert**
```yaml
# Alert when pass rate drops below 80%
groups:
  - name: testops_alerts
    rules:
      - alert: HighTestFailureRate
        expr: testops_pass_rate_percent < 80
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Test pass rate below 80%"
          description: "Current pass rate: {{ $value }}%"
```

2. **RCA Coverage Alert**
```yaml
# Alert when RCA documentation coverage is low
- alert: LowRCACoverage
  expr: testops_rca_coverage_percent < 70
  for: 1h
  labels:
    severity: warning
  annotations:
    summary: "Low RCA documentation coverage"
    description: "Only {{ $value }}% of failures have documented RCAs"
```

3. **Performance Degradation Alert**
```yaml
# Alert when P95 execution time increases significantly
- alert: TestPerformanceDegradation
  expr: testops_execution_time_p95_seconds > 10
  for: 30m
  labels:
    severity: critical
  annotations:
    summary: "Test execution time degradation"
    description: "P95 execution time: {{ $value }}s (threshold: 10s)"
```

See [complete alerting guide](integrations/grafana.md#alerting-configuration) for more examples.

### Alert Channels

1. Slack Integration
```typescript
const sendSlackAlert = async (alert: Alert) => {
  await slack.chat.postMessage({
    channel: config.notifications.slack.channel,
    text: formatAlertMessage(alert),
    attachments: [{
      color: alert.severity === 'critical' ? '#ff0000' : '#ffcc00',
      fields: alert.fields
    }]
  });
};
```

2. Email Alerts
```typescript
const sendEmailAlert = async (alert: Alert) => {
  await mailer.sendMail({
    to: config.notifications.email.recipients,
    subject: `[${alert.severity.toUpperCase()}] ${alert.summary}`,
    html: formatAlertEmail(alert)
  });
};
```

## Dashboards

### Pre-built Grafana Dashboard

TestOps Copilot includes a **pre-built Grafana dashboard** at `grafana-dashboards/testops-overview.json`.

**Import Instructions:**
1. Open Grafana
2. Go to Dashboards → Import
3. Upload `grafana-dashboards/testops-overview.json`
4. Select your Prometheus datasource
5. Click Import

**Dashboard Includes:**
1. **Test Health Overview**
   - Total test runs with trend indicator
   - Pass rate gauge (0-100%)
   - Test runs over time (passed vs failed)

2. **Failure Analysis**
   - Failures archived count
   - RCA coverage percentage
   - Top failing tests breakdown (pie chart)

3. **Performance Metrics**
   - Execution time percentiles (P50, P95, P99)
   - Performance trends over time

**Auto-refresh:** 30 seconds
**Time range:** Last 6 hours (configurable)

See [complete dashboard documentation](integrations/grafana.md#pre-built-dashboard).

### Custom Dashboards

Create custom dashboards using PromQL queries:

```promql
# Example: Pass rate over time
testops_pass_rate_percent

# Example: P95 execution time
testops_execution_time_p95_seconds

# Example: RCA coverage trend
testops_rca_coverage_percent
```

### Dashboard Export

```bash
# Export custom dashboard
curl -H "Authorization: Bearer ${GRAFANA_API_KEY}" \
     http://localhost:3000/api/dashboards/uid/${DASHBOARD_UID} \
     > dashboards/custom-dashboard.json
```

## Health Checks

### Endpoint Implementation

```typescript
// backend/src/routes/health.ts
router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      externalServices: await checkExternalServices()
    }
  };
  
  const unhealthy = Object.values(health.checks)
    .some(check => !check.healthy);
    
  res.status(unhealthy ? 503 : 200).json(health);
});
```

### Kubernetes Probes

```yaml
# kubernetes/deployment.yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```

## Log Management

### Log Rotation

```javascript
// backend/src/config/winston.ts
import 'winston-daily-rotate-file';

const fileRotateTransport = new winston.transports.DailyRotateFile({
  filename: 'logs/application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxFiles: '14d',
  maxSize: '20m',
  compress: true
});
```

### Log Aggregation

Using Elasticsearch, Logstash, and Kibana (ELK):

```yaml
# logstash/pipeline/logstash.conf
input {
  file {
    path => "/app/logs/*.log"
    type => "application"
    codec => json
  }
}

filter {
  date {
    match => [ "timestamp", "ISO8601" ]
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "testops-logs-%{+YYYY.MM.dd}"
  }
}
```

## Monitoring Best Practices

1. Use structured logging
2. Implement proper error handling
3. Set up appropriate alerting
4. Monitor system resources
5. Track business metrics
6. Maintain audit logs
7. Regular maintenance
8. Document procedures
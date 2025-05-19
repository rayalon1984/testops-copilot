# Monitoring and Logging Guide

## Overview

This guide covers monitoring, logging, and observability practices for TestOps Companion.

## Monitoring Stack

- Prometheus for metrics collection
- Grafana for visualization
- Sentry for error tracking
- Winston for logging
- New Relic for APM (optional)

## Application Metrics

### Key Metrics

1. Pipeline Metrics
```typescript
// backend/src/services/metrics.service.ts
const pipelineMetrics = {
  executionTime: new Gauge({
    name: 'pipeline_execution_time_seconds',
    help: 'Pipeline execution time in seconds',
    labelNames: ['pipeline_id', 'type']
  }),
  successRate: new Gauge({
    name: 'pipeline_success_rate_percent',
    help: 'Pipeline success rate percentage',
    labelNames: ['pipeline_id']
  })
};
```

2. Test Metrics
```typescript
const testMetrics = {
  testCount: new Counter({
    name: 'test_total_count',
    help: 'Total number of tests executed',
    labelNames: ['status']
  }),
  flakyTests: new Gauge({
    name: 'test_flaky_count',
    help: 'Number of flaky tests',
    labelNames: ['pipeline_id']
  })
};
```

3. API Metrics
```typescript
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

### Metric Collection

```typescript
// Middleware for collecting HTTP metrics
app.use((req, res, next) => {
  const start = process.hrtime();
  
  res.on('finish', () => {
    const duration = process.hrtime(start);
    apiMetrics.requestDuration.observe(
      { method: req.method, route: req.route?.path, status_code: res.statusCode },
      duration[0] + duration[1] / 1e9
    );
  });
  
  next();
});
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

### Alert Rules

1. Pipeline Failures
```yaml
# prometheus/alerts/pipeline.yml
groups:
  - name: pipeline
    rules:
      - alert: HighPipelineFailureRate
        expr: pipeline_success_rate_percent < 80
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: High pipeline failure rate
```

2. API Health
```yaml
groups:
  - name: api
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
```

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

### Grafana Dashboards

1. Pipeline Overview
- Success rate over time
- Average execution time
- Test results distribution
- Flaky test trends

2. API Performance
- Request rate
- Response times
- Error rates
- Status code distribution

3. System Health
- CPU usage
- Memory usage
- Database connections
- Cache hit rates

### Dashboard Export

```bash
# Export dashboard
curl -H "Authorization: Bearer ${GRAFANA_API_KEY}" \
     http://localhost:3000/api/dashboards/uid/${DASHBOARD_UID} \
     > dashboards/pipeline-overview.json
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
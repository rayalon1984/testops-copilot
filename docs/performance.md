# Performance Optimization Guide

## Overview

This guide covers performance optimization strategies for both frontend and backend components of TestOps Copilot.

## Frontend Performance

### Code Splitting

```typescript
// frontend/src/App.tsx
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const PipelineList = lazy(() => import('./pages/PipelineList'));
const TestRunList = lazy(() => import('./pages/TestRunList'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pipelines" element={<PipelineList />} />
        <Route path="/test-runs" element={<TestRunList />} />
      </Routes>
    </Suspense>
  );
}
```

### React Query Optimization

```typescript
// frontend/src/hooks/usePipelines.ts
export const usePipelines = (filters: PipelineFilters) => {
  return useQuery({
    queryKey: ['pipelines', filters],
    queryFn: () => fetchPipelines(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    keepPreviousData: true,
  });
};

// Prefetching
const prefetchNextPage = async (page: number) => {
  await queryClient.prefetchQuery({
    queryKey: ['pipelines', { ...filters, page: page + 1 }],
    queryFn: () => fetchPipelines({ ...filters, page: page + 1 }),
  });
};
```

### Virtual Lists

```typescript
// frontend/src/components/TestRunList.tsx
import { VirtualizedList } from 'react-virtualized';

export const TestRunList: React.FC<Props> = ({ testRuns }) => {
  const rowRenderer = ({ index, key, style }) => (
    <div key={key} style={style}>
      <TestRunItem testRun={testRuns[index]} />
    </div>
  );

  return (
    <VirtualizedList
      width={800}
      height={600}
      rowCount={testRuns.length}
      rowHeight={80}
      rowRenderer={rowRenderer}
    />
  );
};
```

### Image Optimization

```typescript
// frontend/src/components/Image.tsx
const Image: React.FC<Props> = ({ src, alt, size }) => {
  return (
    <picture>
      <source
        srcSet={`${src}?w=${size * 2} 2x, ${src}?w=${size} 1x`}
        type="image/webp"
      />
      <img
        src={`${src}?w=${size}`}
        alt={alt}
        loading="lazy"
        width={size}
        height={size}
      />
    </picture>
  );
};
```

## Backend Performance

### Database Optimization

#### Query Optimization

```typescript
// backend/src/services/pipeline.service.ts
class PipelineService {
  async getPipelines(filters: PipelineFilters) {
    return Pipeline.findAll({
      where: this.buildFilters(filters),
      include: [
        {
          model: TestRun,
          attributes: ['id', 'status'], // Select only needed fields
          limit: 5,
          order: [['createdAt', 'DESC']],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: filters.limit,
      offset: (filters.page - 1) * filters.limit,
    });
  }

  private buildFilters(filters: PipelineFilters) {
    return {
      ...(filters.status && { status: filters.status }),
      ...(filters.type && { type: filters.type }),
      ...(filters.tags && {
        tags: { [Op.overlap]: filters.tags },
      }),
    };
  }
}
```

#### Indexing Strategy

```sql
-- Database indexes
CREATE INDEX idx_pipelines_user_id ON pipelines(user_id);
CREATE INDEX idx_pipelines_status ON pipelines(status);
CREATE INDEX idx_pipelines_created_at ON pipelines(created_at DESC);
CREATE INDEX idx_test_runs_pipeline_id ON test_runs(pipeline_id);
CREATE INDEX idx_test_runs_status ON test_runs(status);
CREATE INDEX idx_pipelines_tags ON pipelines USING gin(tags);
```

### Caching

#### Redis Caching

```typescript
// backend/src/services/cache.service.ts
class CacheService {
  private readonly redis: Redis;
  private readonly defaultTTL = 3600; // 1 hour

  async get<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set(key: string, value: any, ttl = this.defaultTTL): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(keys);
    }
  }
}
```

#### Query Caching

```typescript
// backend/src/services/pipeline.service.ts
class PipelineService {
  async getPipelineStats(pipelineId: string): Promise<PipelineStats> {
    const cacheKey = `pipeline:${pipelineId}:stats`;
    
    // Try cache first
    const cached = await cache.get<PipelineStats>(cacheKey);
    if (cached) return cached;

    // Calculate stats
    const stats = await this.calculatePipelineStats(pipelineId);
    
    // Cache results
    await cache.set(cacheKey, stats, 300); // 5 minutes TTL
    
    return stats;
  }
}
```

### Request Processing

#### Batch Processing

```typescript
// backend/src/services/notification.service.ts
class NotificationService {
  private queue: Notification[] = [];
  private batchSize = 100;
  private batchTimeout = 5000; // 5 seconds

  async addNotification(notification: Notification): Promise<void> {
    this.queue.push(notification);

    if (this.queue.length >= this.batchSize) {
      await this.processBatch();
    }
  }

  private async processBatch(): Promise<void> {
    const batch = this.queue.splice(0, this.batchSize);
    await Promise.all(batch.map(this.sendNotification));
  }
}
```

#### Background Jobs

```typescript
// backend/src/jobs/cleanup.job.ts
import { CronJob } from 'cron';

const cleanupJob = new CronJob('0 0 * * *', async () => {
  try {
    // Delete old test runs
    await TestRun.destroy({
      where: {
        createdAt: {
          [Op.lt]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    });

    // Clean up artifacts
    await cleanupArtifacts();

    // Aggregate metrics
    await aggregateMetrics();
  } catch (error) {
    logger.error('Cleanup job failed:', error);
  }
});
```

## API Performance

### Response Compression

```typescript
// backend/src/middleware/compression.ts
import compression from 'compression';

app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
}));
```

### Response Streaming

```typescript
// backend/src/controllers/test.controller.ts
class TestController {
  async streamLogs(req: Request, res: Response): Promise<void> {
    const testRun = await TestRun.findByPk(req.params.id);
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const logStream = await testRun.getLogStream();
    logStream.pipe(res);

    req.on('close', () => {
      logStream.destroy();
    });
  }
}
```

## Monitoring Performance

### Performance Metrics

```typescript
// backend/src/services/metrics.service.ts
class MetricsService {
  recordApiLatency(route: string, method: string, duration: number): void {
    metrics.histogram({
      name: 'api_request_duration_seconds',
      help: 'API request duration in seconds',
      labelNames: ['route', 'method'],
    }).observe({ route, method }, duration);
  }

  recordDatabaseQuery(query: string, duration: number): void {
    metrics.histogram({
      name: 'database_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['query'],
    }).observe({ query }, duration);
  }
}
```

### Performance Logging

```typescript
// backend/src/middleware/performance.ts
export const performanceLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start = process.hrtime();

  res.on('finish', () => {
    const duration = process.hrtime(start);
    const durationMs = (duration[0] * 1e3 + duration[1] * 1e-6).toFixed(2);

    logger.info('Request processed', {
      method: req.method,
      url: req.url,
      duration: `${durationMs}ms`,
      status: res.statusCode,
    });
  });

  next();
};
```

## Performance Testing

### Load Testing

```typescript
// tests/performance/load.test.ts
import { check } from 'k6';
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '1m', target: 50 },  // Ramp up
    { duration: '3m', target: 50 },  // Stay at 50 users
    { duration: '1m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'],   // Less than 1% can fail
  },
};

export default function() {
  const response = http.get('http://localhost:3000/api/v1/pipelines');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time OK': (r) => r.timings.duration < 500,
  });
}
```

## Performance Checklist

### Frontend
- [ ] Implement code splitting
- [ ] Optimize images
- [ ] Use lazy loading
- [ ] Implement caching
- [ ] Minimize bundle size
- [ ] Use performance monitoring

### Backend
- [ ] Optimize database queries
- [ ] Implement caching
- [ ] Use appropriate indexes
- [ ] Implement batch processing
- [ ] Monitor performance
- [ ] Use connection pooling

### API
- [ ] Use compression
- [ ] Implement rate limiting
- [ ] Cache responses
- [ ] Use pagination
- [ ] Monitor endpoints
- [ ] Optimize payload size
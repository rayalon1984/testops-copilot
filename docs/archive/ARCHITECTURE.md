# AI Integration - Technical Architecture Document

**Version**: 1.0
**Status**: Draft
**Owner**: Engineering
**Last Updated**: 2025-11-20

---

## 📐 Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     TestOps Copilot                            │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Application Layer                       │  │
│  │                                                            │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │  │
│  │  │Dashboard │  │   CLI    │  │   API    │  │ Webhooks │ │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │  │
│  └───────┼─────────────┼─────────────┼─────────────┼────────┘  │
│          │             │             │             │            │
│  ┌───────┴─────────────┴─────────────┴─────────────┴────────┐  │
│  │                    Core Services                          │  │
│  │                                                            │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │  │
│  │  │   Test      │  │    RCA      │  │ Integration │      │  │
│  │  │   Runner    │  │  Tracker    │  │   Manager   │      │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘      │  │
│  └─────────┼─────────────────┼─────────────────┼────────────┘  │
│            │                 │                 │                │
│  ┌─────────┴─────────────────┴─────────────────┴────────────┐  │
│  │                  AI Service Layer  ⭐ NEW                 │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────┐    │  │
│  │  │            AI Service Manager                     │    │  │
│  │  │  - Provider routing                               │    │  │
│  │  │  - Cost tracking                                  │    │  │
│  │  │  - Caching                                        │    │  │
│  │  │  - Rate limiting                                  │    │  │
│  │  └────────┬──────────────────────────────────────┬──┘    │  │
│  │           │                                       │        │  │
│  │  ┌────────┴────────┐                    ┌────────┴─────┐ │  │
│  │  │  Provider       │                    │   Vector     │ │  │
│  │  │  Abstraction    │                    │   Database   │ │  │
│  │  │                 │                    │  (Weaviate)  │ │  │
│  │  │  - Anthropic    │                    │              │ │  │
│  │  │  - OpenAI       │                    │  - Embed     │ │  │
│  │  │  - Google       │                    │  - Search    │ │  │
│  │  │  - Azure        │                    │  - Index     │ │  │
│  │  └────────┬────────┘                    └──────────────┘ │  │
│  └───────────┼──────────────────────────────────────────────┘  │
│              │                                                  │
│  ┌───────────┴─────────────────────────────────────────────┐  │
│  │                  Data Layer                              │  │
│  │                                                           │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │  │
│  │  │PostgreSQL│  │  Redis   │  │  S3/Blob │  │ Metrics │ │  │
│  │  │   (DB)   │  │ (Cache)  │  │  (Logs)  │  │  (Prom) │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ External APIs
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
      ┌────▼─────┐      ┌────▼─────┐      ┌────▼─────┐
      │Anthropic │      │  OpenAI  │      │  Google  │
      │  Claude  │      │  GPT-4   │      │  Gemini  │
      └──────────┘      └──────────┘      └──────────┘
```

---

## 🏗️ Component Design

### 1. AI Service Manager

**Purpose**: Central orchestrator for all AI operations

**Responsibilities**:
- Route requests to appropriate AI provider
- Track costs per request
- Implement caching to reduce redundant calls
- Rate limiting to prevent quota exhaustion
- Circuit breaker for failed providers
- Fallback logic when AI unavailable

**Interface**:
```typescript
interface AIServiceManager {
  // Core methods
  chat(prompt: string, options?: ChatOptions): Promise<AIResponse>;
  embed(text: string): Promise<number[]>;
  categorize(failure: TestFailure): Promise<FailureCategory>;
  summarize(logs: string): Promise<LogSummary>;
  findSimilar(failure: TestFailure): Promise<SimilarFailure[]>;

  // Management
  getProvider(): AIProvider;
  switchProvider(provider: string, model?: string): Promise<void>;
  getCostSummary(timeRange: TimeRange): Promise<CostSummary>;
  isAvailable(): boolean;
}
```

**Key Design Decisions**:
- ✅ **Single entry point**: All AI calls go through this manager
- ✅ **Provider agnostic**: Business logic doesn't know which provider is used
- ✅ **Graceful degradation**: Returns cached/basic results if AI fails
- ✅ **Cost conscious**: Tracks every request and alerts on budget

---

### 2. Provider Abstraction Layer

**Purpose**: Normalize API differences between AI providers

**Architecture**:
```typescript
// Base interface all providers must implement
interface AIProvider {
  name: string;

  // Configuration
  configure(config: ProviderConfig): Promise<void>;
  validate(): Promise<boolean>;

  // Core capabilities
  chat(messages: Message[], options?: ChatOptions): Promise<string>;
  embed(text: string): Promise<number[]>;

  // Metadata
  getModels(): AIModel[];
  getCostPerToken(model: string): { input: number; output: number };

  // Health
  healthCheck(): Promise<HealthStatus>;
}

// Provider-specific implementations
class AnthropicProvider implements AIProvider {
  private client: Anthropic;

  async chat(messages: Message[], options?: ChatOptions): Promise<string> {
    const response = await this.client.messages.create({
      model: options?.model || 'claude-sonnet-4-20250514',
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: options?.maxTokens || 4000,
      temperature: options?.temperature || 0.7,
    });

    // Track costs
    this.trackUsage(response.usage);

    return response.content[0].text;
  }

  async embed(text: string): Promise<number[]> {
    // Anthropic doesn't have native embeddings, use Voyage AI
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.voyageApiKey}` },
      body: JSON.stringify({ input: text, model: 'voyage-2' })
    });
    const data = await response.json();
    return data.data[0].embedding;
  }
}

class OpenAIProvider implements AIProvider {
  private client: OpenAI;

  async chat(messages: Message[], options?: ChatOptions): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: options?.model || 'gpt-4-turbo',
      messages: messages,
      max_tokens: options?.maxTokens || 4000,
      temperature: options?.temperature || 0.7,
    });

    this.trackUsage(response.usage);

    return response.choices[0].message.content;
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-large',
      input: text,
    });
    return response.data[0].embedding;
  }
}
```

**Provider Registry**:
```typescript
class ProviderRegistry {
  private providers: Map<string, AIProvider> = new Map();

  register(name: string, provider: AIProvider): void {
    this.providers.set(name, provider);
  }

  get(name: string): AIProvider {
    if (!this.providers.has(name)) {
      throw new Error(`Provider ${name} not registered`);
    }
    return this.providers.get(name)!;
  }

  list(): string[] {
    return Array.from(this.providers.keys());
  }
}

// Bootstrap
const registry = new ProviderRegistry();
registry.register('anthropic', new AnthropicProvider());
registry.register('openai', new OpenAIProvider());
registry.register('google', new GoogleProvider());
registry.register('azure', new AzureProvider());
```

---

### 3. Vector Database Integration

**Purpose**: Store and search embeddings for semantic similarity

**Technology Choice**: **Weaviate** (self-hosted)

**Why Weaviate?**
- ✅ Open-source, can run locally
- ✅ Excellent performance (Rust-based)
- ✅ Good documentation and community
- ✅ Cost: $0 (self-hosted) vs Pinecone $70+/month
- ✅ Flexible schema
- ✅ Built-in hybrid search (vector + keyword)

**Schema Design**:
```graphql
type TestFailure {
  # Core fields
  testId: string!
  testName: string!
  errorMessage: string!
  stackTrace: string
  logSnippet: string

  # Metadata
  pipeline: string
  branch: string
  commitHash: string
  timestamp: datetime!

  # Embeddings (auto-generated by Weaviate)
  embedding: vector

  # RCA tracking
  rcaDocumentId: string
  resolution: string
  resolvedAt: datetime
  resolvedBy: string

  # Categorization
  category: string  # Bug, Environment, Flaky, Config
  categoryConfidence: float

  # Relationships
  similarFailures: [TestFailure]
  relatedTickets: [Ticket]
}
```

**Vector Search**:
```typescript
class VectorDatabase {
  private client: WeaviateClient;

  async indexFailure(failure: TestFailure): Promise<void> {
    // Generate embedding
    const text = `${failure.testName} ${failure.errorMessage} ${failure.stackTrace}`;
    const embedding = await this.aiService.embed(text);

    // Store in Weaviate
    await this.client.data
      .creator()
      .withClassName('TestFailure')
      .withProperties({
        testId: failure.testId,
        testName: failure.testName,
        errorMessage: failure.errorMessage,
        stackTrace: failure.stackTrace,
        timestamp: failure.timestamp.toISOString(),
        // ... other fields
      })
      .withVector(embedding)
      .do();
  }

  async findSimilar(failure: TestFailure, limit: number = 5): Promise<SimilarFailure[]> {
    // Generate embedding for query
    const text = `${failure.testName} ${failure.errorMessage}`;
    const embedding = await this.aiService.embed(text);

    // Search
    const results = await this.client.graphql
      .get()
      .withClassName('TestFailure')
      .withNearVector({ vector: embedding })
      .withLimit(limit)
      .withFields('testId testName errorMessage resolution _additional { distance }')
      .do();

    return results.data.Get.TestFailure.map((item: any) => ({
      failure: item,
      similarity: 1 - item._additional.distance,  // Convert distance to similarity
    }));
  }

  async findByCategory(category: string, limit: number = 10): Promise<TestFailure[]> {
    return await this.client.graphql
      .get()
      .withClassName('TestFailure')
      .withWhere({
        path: ['category'],
        operator: 'Equal',
        valueString: category,
      })
      .withLimit(limit)
      .withFields('testId testName errorMessage timestamp')
      .do();
  }
}
```

---

### 4. Cost Tracking System

**Purpose**: Monitor AI usage and prevent budget overruns

**Database Schema**:
```sql
CREATE TABLE ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255),
  team_id VARCHAR(255),

  -- Request details
  provider VARCHAR(50) NOT NULL,  -- anthropic, openai, google
  model VARCHAR(100) NOT NULL,
  feature VARCHAR(50) NOT NULL,  -- rca_matching, categorization, summarization

  -- Token usage
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,

  -- Cost calculation
  input_cost DECIMAL(10, 6) NOT NULL,
  output_cost DECIMAL(10, 6) NOT NULL,
  total_cost DECIMAL(10, 6) NOT NULL,

  -- Metadata
  request_id VARCHAR(255),
  response_time_ms INTEGER,
  cache_hit BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),

  -- Indexes
  INDEX idx_team_created (team_id, created_at),
  INDEX idx_feature_created (feature, created_at)
);

CREATE TABLE ai_budget_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id VARCHAR(255) UNIQUE NOT NULL,

  -- Budget settings
  monthly_limit_usd DECIMAL(10, 2) NOT NULL,
  current_month_spend DECIMAL(10, 2) DEFAULT 0,
  alert_threshold_percent INTEGER DEFAULT 80,

  -- Status
  budget_exceeded BOOLEAN DEFAULT false,
  last_reset_at TIMESTAMP DEFAULT NOW(),

  -- Notifications
  alert_email VARCHAR(255),
  alert_slack_webhook TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Cost Tracking Service**:
```typescript
class CostTracker {
  async trackUsage(params: {
    userId: string;
    teamId: string;
    provider: string;
    model: string;
    feature: string;
    inputTokens: number;
    outputTokens: number;
    responseTimeMs: number;
    cacheHit: boolean;
  }): Promise<void> {
    // Calculate cost
    const pricing = await this.getPricing(params.provider, params.model);
    const inputCost = (params.inputTokens / 1000) * pricing.inputPer1k;
    const outputCost = (params.outputTokens / 1000) * pricing.outputPer1k;
    const totalCost = inputCost + outputCost;

    // Log usage
    await this.db.query(`
      INSERT INTO ai_usage_logs
      (user_id, team_id, provider, model, feature,
       input_tokens, output_tokens, total_tokens,
       input_cost, output_cost, total_cost,
       response_time_ms, cache_hit)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      params.userId, params.teamId, params.provider, params.model, params.feature,
      params.inputTokens, params.outputTokens, params.inputTokens + params.outputTokens,
      inputCost, outputCost, totalCost,
      params.responseTimeMs, params.cacheHit
    ]);

    // Update team's monthly spend
    await this.updateTeamSpend(params.teamId, totalCost);

    // Check budget
    await this.checkBudgetLimit(params.teamId);
  }

  async checkBudgetLimit(teamId: string): Promise<void> {
    const budget = await this.db.queryOne(`
      SELECT monthly_limit_usd, current_month_spend, alert_threshold_percent, budget_exceeded
      FROM ai_budget_limits
      WHERE team_id = $1
    `, [teamId]);

    if (!budget) return;

    const percentUsed = (budget.current_month_spend / budget.monthly_limit_usd) * 100;

    // Alert at threshold
    if (percentUsed >= budget.alert_threshold_percent && percentUsed < 100) {
      await this.sendAlert(teamId, 'warning', percentUsed);
    }

    // Hard stop at 100%
    if (percentUsed >= 100 && !budget.budget_exceeded) {
      await this.db.query(`
        UPDATE ai_budget_limits
        SET budget_exceeded = true
        WHERE team_id = $1
      `, [teamId]);

      await this.sendAlert(teamId, 'exceeded', percentUsed);
    }
  }

  async getMonthlySpend(teamId: string): Promise<CostSummary> {
    const result = await this.db.query(`
      SELECT
        COUNT(*) as total_requests,
        SUM(total_tokens) as total_tokens,
        SUM(total_cost) as total_cost,
        AVG(response_time_ms) as avg_response_time,
        SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) as cache_hits,
        feature,
        provider
      FROM ai_usage_logs
      WHERE team_id = $1
        AND created_at >= date_trunc('month', NOW())
      GROUP BY feature, provider
    `, [teamId]);

    return {
      totalCost: result.reduce((sum, r) => sum + parseFloat(r.total_cost), 0),
      totalRequests: result.reduce((sum, r) => sum + parseInt(r.total_requests), 0),
      byFeature: result,
      cacheHitRate: (result[0].cache_hits / result[0].total_requests) * 100,
    };
  }
}
```

---

### 5. Caching Strategy

**Purpose**: Reduce costs and improve performance

**Cache Layers**:

**L1: Response Cache** (Redis)
- Cache AI responses for identical inputs
- TTL: 7 days for RCA matching, 1 day for categorization
- Key: hash(provider + model + prompt)

**L2: Embedding Cache** (Redis)
- Cache embeddings for test failures
- TTL: 30 days (embeddings don't change)
- Key: hash(text content)

**L3: Summary Cache** (PostgreSQL)
- Cache log summaries permanently
- Keyed by log content hash
- Only invalidate if logs change

```typescript
class AICache {
  private redis: Redis;

  async getCachedResponse(key: string): Promise<string | null> {
    return await this.redis.get(`ai:response:${key}`);
  }

  async setCachedResponse(key: string, response: string, ttlSeconds: number): Promise<void> {
    await this.redis.setex(`ai:response:${key}`, ttlSeconds, response);
  }

  async getCachedEmbedding(text: string): Promise<number[] | null> {
    const key = this.hashText(text);
    const cached = await this.redis.get(`ai:embedding:${key}`);
    return cached ? JSON.parse(cached) : null;
  }

  async setCachedEmbedding(text: string, embedding: number[]): Promise<void> {
    const key = this.hashText(text);
    await this.redis.setex(`ai:embedding:${key}`, 30 * 86400, JSON.stringify(embedding));
  }

  private hashText(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }
}
```

**Cache Invalidation**:
- Embeddings: Never (content-addressed)
- RCA responses: When new similar failure is resolved
- Categorizations: When user provides feedback
- Summaries: When log content changes

---

## 🔄 Data Flow

### Flow 1: Smart RCA Matching

```
1. New test failure detected
   ↓
2. Extract: test name, error message, stack trace
   ↓
3. Check embedding cache
   ├─ Hit: Use cached embedding
   └─ Miss: Generate embedding via AI provider
   ↓
4. Search vector DB for similar failures (cosine similarity > 0.75)
   ↓
5. Return top 5 matches
   ↓
6. For each match, generate explanation with AI
   ├─ Check response cache
   ├─ Hit: Return cached explanation
   └─ Miss: Call AI provider, cache result
   ↓
7. Display results to user with confidence scores
   ↓
8. User confirms similarity → Update feedback data
```

### Flow 2: Automated Categorization

```
1. Test failure occurs
   ↓
2. Collect context:
   - Error message
   - Stack trace
   - Historical data (how often it fails)
   - Timing patterns
   - Environment status
   ↓
3. Check if previously categorized (cache)
   ├─ Hit: Return cached category
   └─ Miss: Continue to AI
   ↓
4. Build categorization prompt:
   """
   Based on this test failure, categorize as:
   - Real Bug (Critical/Minor)
   - Environment Issue
   - Flaky Test
   - Configuration Error

   Failure: {error}
   History: {history}
   Timing: {timing}
   """
   ↓
5. Call AI provider (structured output)
   ↓
6. Parse response:
   {
     category: "Environment",
     confidence: 0.92,
     reasoning: "Service timeout suggests infra issue"
   }
   ↓
7. Store in DB + cache
   ↓
8. If confidence < 0.7, flag for manual review
   ↓
9. Route to appropriate team based on category
```

### Flow 3: Log Summarization

```
1. User requests log summary
   ↓
2. Check if log already summarized (hash-based lookup)
   ├─ Hit: Return cached summary
   └─ Miss: Continue to AI
   ↓
3. Preprocess log:
   - Truncate to 50k chars if needed
   - Redact sensitive data (API keys, passwords)
   - Extract key patterns
   ↓
4. Build summarization prompt:
   """
   Summarize this log and identify:
   - Root cause
   - Error location (line number)
   - Suggested fix

   Log:
   {log_content}
   """
   ↓
5. Call AI provider with streaming
   ↓
6. Stream response to user in real-time
   ↓
7. Cache final summary (permanent)
   ↓
8. Track usage and cost
```

---

## 🔒 Security & Privacy

### Data Handling

**What gets sent to AI providers:**
- ✅ Test names (sanitized)
- ✅ Error messages (redacted)
- ✅ Stack traces (file paths only, no source code)
- ✅ Log snippets (first/last 100 lines)

**What NEVER gets sent:**
- ❌ Source code
- ❌ API keys, tokens, passwords
- ❌ Customer PII
- ❌ Database credentials
- ❌ Full logs (only snippets)

**Redaction Engine**:
```typescript
class DataRedactor {
  private patterns = [
    /api[_-]?key[s]?\s*[:=]\s*['"]?([a-zA-Z0-9_\-]+)['"]?/gi,
    /password[s]?\s*[:=]\s*['"]?([^\s'"]+)['"]?/gi,
    /token[s]?\s*[:=]\s*['"]?([a-zA-Z0-9_\-\.]+)['"]?/gi,
    /bearer\s+([a-zA-Z0-9_\-\.]+)/gi,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,  // emails
    /\b\d{3}-\d{2}-\d{4}\b/gi,  // SSN
    /\b(?:\d{4}[-\s]?){3}\d{4}\b/gi,  // credit cards
  ];

  redact(text: string): string {
    let redacted = text;

    for (const pattern of this.patterns) {
      redacted = redacted.replace(pattern, (match, group1) => {
        return match.replace(group1, '[REDACTED]');
      });
    }

    return redacted;
  }
}
```

**Audit Log**:
```sql
CREATE TABLE ai_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  team_id VARCHAR(255) NOT NULL,

  -- Request
  feature VARCHAR(50) NOT NULL,
  input_hash VARCHAR(64) NOT NULL,  -- SHA256 of input
  input_length INTEGER NOT NULL,

  -- Response
  output_length INTEGER,
  provider VARCHAR(50),
  model VARCHAR(100),

  -- Compliance
  data_redacted BOOLEAN DEFAULT false,
  pii_detected BOOLEAN DEFAULT false,

  -- Timestamps
  requested_at TIMESTAMP DEFAULT NOW(),
  responded_at TIMESTAMP
);
```

---

## 🚀 Performance & Scalability

### Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| RCA matching | < 5s | Including embedding + search + AI explanation |
| Categorization | < 3s | Fast path for common patterns |
| Log summarization | < 10s | Streaming response starts in < 2s |
| Embedding generation | < 1s | Cached after first generation |
| Vector search | < 500ms | Weaviate is fast |

### Optimization Strategies

**1. Batch Processing**
```typescript
// Instead of processing failures one-by-one
for (const failure of failures) {
  await categorize(failure);  // ❌ Slow: N API calls
}

// Batch them
const categories = await categorizeBatch(failures);  // ✅ Fast: 1 API call
```

**2. Parallel Processing**
```typescript
// Process independent tasks in parallel
const [similar, category, summary] = await Promise.all([
  findSimilar(failure),
  categorize(failure),
  summarize(failure.logs),
]);
```

**3. Lazy Loading**
```typescript
// Don't generate AI insights until user requests them
interface FailureResponse {
  id: string;
  testName: string;
  errorMessage: string;

  // Lazy-loaded
  similarFailures?: Promise<SimilarFailure[]>;
  aiCategory?: Promise<FailureCategory>;
  logSummary?: Promise<string>;
}
```

**4. Background Jobs**
```typescript
// Offload expensive operations to background queue
queue.enqueue('ai:embed-failure', { failureId: failure.id });
queue.enqueue('ai:categorize-failure', { failureId: failure.id });

// Process asynchronously
worker.on('ai:embed-failure', async (job) => {
  const failure = await db.getFailure(job.failureId);
  const embedding = await aiService.embed(failure.text);
  await vectorDB.index(failure.id, embedding);
});
```

### Scalability Considerations

**Horizontal Scaling**:
- AI Service Manager: Stateless, scales horizontally
- Vector DB: Sharded by team_id
- Cache: Redis cluster for high throughput
- Queue: BullMQ for distributed job processing

**Rate Limiting**:
```typescript
class RateLimiter {
  private limits = {
    anthropic: 4000,  // requests/minute
    openai: 3000,
    google: 1500,
  };

  async checkLimit(provider: string, userId: string): Promise<boolean> {
    const key = `ratelimit:${provider}:${userId}`;
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, 60);  // 1 minute window
    }

    return current <= this.limits[provider];
  }
}
```

---

## 📊 Monitoring & Observability

### Metrics to Track

**AI Service Metrics**:
- `ai.requests.total` (counter) - by provider, model, feature
- `ai.requests.duration` (histogram) - latency distribution
- `ai.requests.errors` (counter) - by error type
- `ai.cost.usd` (gauge) - real-time cost tracking
- `ai.cache.hit_rate` (gauge) - cache effectiveness
- `ai.tokens.used` (counter) - input + output tokens

**Vector DB Metrics**:
- `vector.search.duration` (histogram)
- `vector.search.results` (histogram) - number of results
- `vector.index.size` (gauge) - total indexed documents

**Example Prometheus Metrics**:
```typescript
import { Counter, Histogram, Gauge } from 'prom-client';

const aiRequestsTotal = new Counter({
  name: 'ai_requests_total',
  help: 'Total AI requests',
  labelNames: ['provider', 'model', 'feature', 'status']
});

const aiRequestDuration = new Histogram({
  name: 'ai_request_duration_seconds',
  help: 'AI request duration',
  labelNames: ['provider', 'feature'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

const aiCostUSD = new Gauge({
  name: 'ai_cost_usd',
  help: 'Current AI cost in USD',
  labelNames: ['team_id']
});
```

### Alerting

**Critical Alerts**:
- Budget exceeded (80%, 100%)
- Error rate > 5%
- Latency P95 > 10s
- Provider downtime

**Warning Alerts**:
- Cache hit rate < 50%
- Cost trending 20% over budget
- Unusual token usage spike

---

## 🧪 Testing Strategy

### Unit Tests
- Provider abstraction: Mock AI responses
- Cost calculation: Test pricing logic
- Redaction: Ensure PII is removed
- Caching: Test hit/miss scenarios

### Integration Tests
- End-to-end RCA matching with real vector DB
- Provider failover scenarios
- Rate limiting enforcement
- Budget limit checks

### Load Tests
- 1000 concurrent RCA requests
- 10k embeddings/minute
- Cache under heavy load
- Database connection pooling

---

## 📝 Configuration

### Environment Variables

```bash
# AI Provider Selection
AI_ENABLED=true
AI_PROVIDER=anthropic  # anthropic | openai | google | azure
AI_MODEL=claude-sonnet-4-20250514

# Provider API Keys
ANTHROPIC_API_KEY=sk-ant-xxxxx
OPENAI_API_KEY=sk-xxxxx
GOOGLE_API_KEY=xxxxx
AZURE_OPENAI_ENDPOINT=https://xxxxx.openai.azure.com
AZURE_OPENAI_KEY=xxxxx

# Embeddings (if using Voyage AI for Anthropic)
VOYAGE_API_KEY=pa-xxxxx

# Vector Database
WEAVIATE_URL=http://localhost:8080
WEAVIATE_API_KEY=xxxxx  # optional

# Cost Management
AI_MONTHLY_BUDGET_USD=100
AI_ALERT_THRESHOLD_PERCENT=80

# Cache
REDIS_URL=redis://localhost:6379
AI_CACHE_TTL_SECONDS=604800  # 7 days

# Rate Limiting
AI_RATE_LIMIT_PER_MINUTE=100
AI_RATE_LIMIT_PER_DAY=10000

# Features (feature flags)
AI_FEATURE_RCA_MATCHING=true
AI_FEATURE_CATEGORIZATION=true
AI_FEATURE_LOG_SUMMARY=true
AI_FEATURE_NL_QUERIES=false  # beta
```

### Config File (Alternative)

```yaml
# config/ai.yml
ai:
  enabled: true
  provider: anthropic
  model: claude-sonnet-4-20250514

  features:
    rca_matching: true
    categorization: true
    log_summary: true
    nl_queries: false

  cost:
    monthly_budget_usd: 100
    alert_threshold: 80
    alert_email: team@example.com

  cache:
    enabled: true
    ttl_seconds: 604800

  rate_limit:
    per_minute: 100
    per_day: 10000
```

---

## 🔄 Migration Path

### Phase 1: Add AI Layer (Non-Breaking)
- Deploy AI services alongside existing code
- All AI features opt-in
- No changes to existing APIs

### Phase 2: Gradual Rollout
- Enable for beta users first
- Monitor costs and performance
- Iterate based on feedback

### Phase 3: Full Integration
- AI features available to all
- Update dashboards with AI insights
- Deprecate old manual workflows

**Rollback Plan**:
- Feature flags allow instant disable
- Fallback to basic features (no AI)
- Zero data loss (AI is additive, not replacing)

---

## ✅ Sign-off

**Technical Lead**: _______________
**Security Review**: _______________
**DevOps Review**: _______________

---

*This architecture document will evolve as we build and learn. All changes should be reviewed by the team.*

# AI Integration - Implementation Plan

**Version**: 1.0
**Status**: Draft
**Owner**: Engineering Team
**Last Updated**: 2025-11-20
**Estimated Duration**: 12 weeks

---

## 📋 Overview

This document provides a detailed, step-by-step implementation plan for integrating AI capabilities into TestOps Copilot. Each phase includes specific tasks, file structure, dependencies, and acceptance criteria.

---

## 🎯 Implementation Phases

### Phase 0: Foundation & Setup (Week 1-2)
**Goal**: Establish base infrastructure for AI integration

#### Week 1: Project Setup

**Tasks**:
1. ✅ Create documentation (PRD, Architecture, API docs)
2. ✅ Set up feature branch: `feature/ai-integration`
3. Install dependencies
4. Create base directory structure
5. Set up configuration system
6. Initialize tests

**Dependencies to Install**:
```bash
# AI Provider SDKs
npm install @anthropic-ai/sdk openai @google/generative-ai @azure/openai

# Vector Database
npm install weaviate-ts-client

# Utilities
npm install zod  # Schema validation
npm install p-queue  # Rate limiting
npm install p-retry  # Retry logic
npm install bull  # Job queue for async tasks
npm install ioredis  # Redis client

# Development
npm install -D @types/node vitest
```

**Directory Structure**:
```
src/
├── services/
│   └── ai/
│       ├── index.ts                    # Main export
│       ├── types.ts                    # TypeScript interfaces
│       ├── config.ts                   # Configuration management
│       ├── manager.ts                  # AI Service Manager
│       ├── cache.ts                    # Caching layer
│       ├── cost-tracker.ts             # Cost tracking
│       ├── redactor.ts                 # Data redaction
│       │
│       ├── providers/
│       │   ├── base.provider.ts        # Base interface
│       │   ├── anthropic.provider.ts   # Claude integration
│       │   ├── openai.provider.ts      # GPT integration
│       │   ├── google.provider.ts      # Gemini integration
│       │   ├── azure.provider.ts       # Azure OpenAI
│       │   └── registry.ts             # Provider registry
│       │
│       ├── features/
│       │   ├── rca-matching.ts         # Smart RCA matching
│       │   ├── categorization.ts       # Failure categorization
│       │   ├── log-summary.ts          # Log summarization
│       │   ├── nl-query.ts             # Natural language queries
│       │   └── ticket-generation.ts    # Ticket generation
│       │
│       └── vector/
│           ├── client.ts               # Weaviate client wrapper
│           ├── schema.ts               # Vector DB schema
│           └── search.ts               # Similarity search
│
├── api/
│   └── routes/
│       └── ai/
│           ├── index.ts                # Route definitions
│           ├── config.routes.ts        # Config endpoints
│           ├── rca.routes.ts           # RCA endpoints
│           ├── categorize.routes.ts    # Categorization endpoints
│           ├── logs.routes.ts          # Log summary endpoints
│           ├── query.routes.ts         # NL query endpoints
│           ├── tickets.routes.ts       # Ticket endpoints
│           └── costs.routes.ts         # Cost endpoints
│
├── cli/
│   └── commands/
│       └── ai/
│           ├── configure.ts            # Configuration wizard
│           ├── status.ts               # Status command
│           ├── analyze.ts              # Analyze command
│           ├── find-similar.ts         # Find similar command
│           ├── summarize.ts            # Summarize command
│           ├── ask.ts                  # NL query command
│           ├── create-ticket.ts        # Create ticket command
│           └── costs.ts                # Cost command
│
├── database/
│   └── migrations/
│       ├── 001_create_ai_usage_logs.sql
│       ├── 002_create_ai_budget_limits.sql
│       └── 003_create_ai_feedback.sql
│
└── tests/
    └── ai/
        ├── unit/
        │   ├── providers.test.ts
        │   ├── cost-tracker.test.ts
        │   ├── redactor.test.ts
        │   └── cache.test.ts
        ├── integration/
        │   ├── rca-matching.test.ts
        │   ├── categorization.test.ts
        │   └── vector-db.test.ts
        └── e2e/
            └── ai-workflow.test.ts
```

**Configuration Files**:

`config/ai.example.yml`:
```yaml
ai:
  enabled: false  # Disabled by default
  provider: anthropic
  model: claude-sonnet-4-20250514

  features:
    rca_matching: true
    categorization: true
    log_summary: true
    nl_queries: false
    ticket_generation: true

  cost:
    monthly_budget_usd: 100
    alert_threshold_percent: 80

  cache:
    enabled: true
    ttl_seconds: 604800  # 7 days

  rate_limit:
    per_minute: 100
    per_day: 10000

  vector_db:
    url: http://localhost:8080
    index_name: testops_failures
```

`.env.example`:
```bash
# AI Provider Credentials
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_API_KEY=
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_KEY=

# Embeddings (for Anthropic users)
VOYAGE_API_KEY=

# Vector Database
WEAVIATE_URL=http://localhost:8080
WEAVIATE_API_KEY=

# Redis Cache
REDIS_URL=redis://localhost:6379
```

**Acceptance Criteria**:
- [ ] All dependencies installed
- [ ] Directory structure created
- [ ] Base configuration files present
- [ ] Tests scaffolded
- [ ] Docker Compose includes Weaviate and Redis

---

#### Week 2: Core Infrastructure

**Task 1: Implement Base Provider Interface**

`src/services/ai/providers/base.provider.ts`:
```typescript
import { z } from 'zod';

export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

export const ChatOptionsSchema = z.object({
  model: z.string().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().min(0).max(2).optional(),
  stream: z.boolean().optional(),
});

export interface AIProvider {
  name: string;

  configure(config: ProviderConfig): Promise<void>;
  validate(): Promise<boolean>;

  chat(messages: ChatMessage[], options?: ChatOptions): Promise<AIResponse>;
  embed(text: string): Promise<number[]>;

  getModels(): AIModel[];
  getCostPerToken(model: string): { input: number; output: number };

  healthCheck(): Promise<HealthStatus>;
}

export abstract class BaseProvider implements AIProvider {
  abstract name: string;
  protected config?: ProviderConfig;

  async configure(config: ProviderConfig): Promise<void> {
    this.config = config;
  }

  abstract validate(): Promise<boolean>;
  abstract chat(messages: ChatMessage[], options?: ChatOptions): Promise<AIResponse>;
  abstract embed(text: string): Promise<number[]>;
  abstract getModels(): AIModel[];
  abstract getCostPerToken(model: string): { input: number; output: number };

  async healthCheck(): Promise<HealthStatus> {
    const start = Date.now();
    try {
      await this.validate();
      return {
        healthy: true,
        provider: this.name,
        latencyMs: Date.now() - start,
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        provider: this.name,
        latencyMs: Date.now() - start,
        error: error.message,
        lastChecked: new Date(),
      };
    }
  }
}
```

**Task 2: Implement Anthropic Provider**

`src/services/ai/providers/anthropic.provider.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider } from './base.provider';

export class AnthropicProvider extends BaseProvider {
  name = 'anthropic' as const;
  private client?: Anthropic;

  async configure(config: ProviderConfig): Promise<void> {
    await super.configure(config);
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
  }

  async validate(): Promise<boolean> {
    if (!this.client) throw new Error('Provider not configured');

    try {
      await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch (error) {
      throw new Error(`Anthropic validation failed: ${error.message}`);
    }
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<AIResponse> {
    if (!this.client) throw new Error('Provider not configured');

    const start = Date.now();

    const response = await this.client.messages.create({
      model: options?.model || 'claude-sonnet-4-20250514',
      max_tokens: options?.maxTokens || 4000,
      temperature: options?.temperature || 0.7,
      messages: messages.map(m => ({
        role: m.role === 'system' ? 'user' : m.role,
        content: m.content,
      })),
    });

    const content = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    const inputCost = (response.usage.input_tokens / 1_000_000) * 3;  // $3/M tokens
    const outputCost = (response.usage.output_tokens / 1_000_000) * 15;  // $15/M tokens

    return {
      content,
      provider: this.name,
      model: response.model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      cost: {
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost,
      },
      cached: false,
      responseTimeMs: Date.now() - start,
    };
  }

  async embed(text: string): Promise<number[]> {
    // Anthropic doesn't have embeddings, use Voyage AI
    const voyageKey = process.env.VOYAGE_API_KEY;
    if (!voyageKey) throw new Error('VOYAGE_API_KEY required for embeddings');

    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${voyageKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        model: 'voyage-2',
      }),
    });

    const data = await response.json();
    return data.data[0].embedding;
  }

  getModels(): AIModel[] {
    return [
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        provider: 'anthropic',
        maxTokens: 200000,
        costPerInputToken: 0.000003,
        costPerOutputToken: 0.000015,
        capabilities: ['rca_matching', 'categorization', 'log_summary', 'nl_query', 'ticket_generation'],
        description: 'Balanced model for most tasks',
      },
      {
        id: 'claude-opus-4-20250514',
        name: 'Claude Opus 4',
        provider: 'anthropic',
        maxTokens: 200000,
        costPerInputToken: 0.000015,
        costPerOutputToken: 0.000075,
        capabilities: ['rca_matching', 'categorization', 'log_summary', 'nl_query', 'ticket_generation'],
        description: 'Most capable model for complex analysis',
      },
    ];
  }

  getCostPerToken(model: string): { input: number; output: number } {
    const costs: Record<string, { input: number; output: number }> = {
      'claude-sonnet-4-20250514': { input: 0.000003, output: 0.000015 },
      'claude-opus-4-20250514': { input: 0.000015, output: 0.000075 },
    };

    return costs[model] || costs['claude-sonnet-4-20250514'];
  }
}
```

**Task 3: Implement OpenAI Provider**

`src/services/ai/providers/openai.provider.ts`:
```typescript
import OpenAI from 'openai';
import { BaseProvider } from './base.provider';

export class OpenAIProvider extends BaseProvider {
  name = 'openai' as const;
  private client?: OpenAI;

  async configure(config: ProviderConfig): Promise<void> {
    await super.configure(config);
    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organizationId,
    });
  }

  async validate(): Promise<boolean> {
    if (!this.client) throw new Error('Provider not configured');

    try {
      await this.client.chat.completions.create({
        model: 'gpt-4-turbo',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch (error) {
      throw new Error(`OpenAI validation failed: ${error.message}`);
    }
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<AIResponse> {
    if (!this.client) throw new Error('Provider not configured');

    const start = Date.now();

    const response = await this.client.chat.completions.create({
      model: options?.model || 'gpt-4-turbo',
      max_tokens: options?.maxTokens || 4000,
      temperature: options?.temperature || 0.7,
      messages,
    });

    const content = response.choices[0].message.content || '';

    const inputCost = (response.usage.prompt_tokens / 1_000_000) * 10;  // $10/M tokens
    const outputCost = (response.usage.completion_tokens / 1_000_000) * 30;  // $30/M tokens

    return {
      content,
      provider: this.name,
      model: response.model,
      usage: {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      },
      cost: {
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost,
      },
      cached: false,
      responseTimeMs: Date.now() - start,
    };
  }

  async embed(text: string): Promise<number[]> {
    if (!this.client) throw new Error('Provider not configured');

    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-large',
      input: text,
    });

    return response.data[0].embedding;
  }

  getModels(): AIModel[] {
    return [
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        provider: 'openai',
        maxTokens: 128000,
        costPerInputToken: 0.00001,
        costPerOutputToken: 0.00003,
        capabilities: ['rca_matching', 'categorization', 'log_summary', 'nl_query', 'ticket_generation'],
        description: 'Fast and capable for most tasks',
      },
      {
        id: 'gpt-4',
        name: 'GPT-4',
        provider: 'openai',
        maxTokens: 8192,
        costPerInputToken: 0.00003,
        costPerOutputToken: 0.00006,
        capabilities: ['rca_matching', 'categorization', 'log_summary', 'nl_query', 'ticket_generation'],
        description: 'Original GPT-4 model',
      },
    ];
  }

  getCostPerToken(model: string): { input: number; output: number } {
    const costs: Record<string, { input: number; output: number }> = {
      'gpt-4-turbo': { input: 0.00001, output: 0.00003 },
      'gpt-4': { input: 0.00003, output: 0.00006 },
    };

    return costs[model] || costs['gpt-4-turbo'];
  }
}
```

**Task 4: Provider Registry**

`src/services/ai/providers/registry.ts`:
```typescript
import { AIProvider } from './base.provider';
import { AnthropicProvider } from './anthropic.provider';
import { OpenAIProvider } from './openai.provider';
import { GoogleProvider } from './google.provider';
import { AzureProvider } from './azure.provider';

export class ProviderRegistry {
  private providers = new Map<string, AIProvider>();

  constructor() {
    this.register(new AnthropicProvider());
    this.register(new OpenAIProvider());
    this.register(new GoogleProvider());
    this.register(new AzureProvider());
  }

  register(provider: AIProvider): void {
    this.providers.set(provider.name, provider);
  }

  get(name: string): AIProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider '${name}' not found. Available: ${this.list().join(', ')}`);
    }
    return provider;
  }

  list(): string[] {
    return Array.from(this.providers.keys());
  }

  has(name: string): boolean {
    return this.providers.has(name);
  }
}

export const providerRegistry = new ProviderRegistry();
```

**Task 5: AI Service Manager**

`src/services/ai/manager.ts`:
```typescript
import { AICache } from './cache';
import { CostTracker } from './cost-tracker';
import { DataRedactor } from './redactor';
import { providerRegistry } from './providers/registry';

export class AIServiceManager {
  private provider?: AIProvider;
  private cache: AICache;
  private costTracker: CostTracker;
  private redactor: DataRedactor;

  constructor() {
    this.cache = new AICache();
    this.costTracker = new CostTracker();
    this.redactor = new DataRedactor();
  }

  async configure(config: AIConfig): Promise<void> {
    const provider = providerRegistry.get(config.provider);

    await provider.configure({
      apiKey: config.apiKey,
      model: config.model,
    });

    const isValid = await provider.validate();
    if (!isValid) {
      throw new Error('Provider validation failed');
    }

    this.provider = provider;
  }

  async chat(prompt: string, options?: ChatOptions): Promise<AIResponse> {
    if (!this.provider) throw new Error('AI service not configured');

    // Check cache first
    const cacheKey = this.cache.generateKey(prompt, options);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    // Redact sensitive data
    const redactedPrompt = this.redactor.redact(prompt);

    // Call provider
    const response = await this.provider.chat(
      [{ role: 'user', content: redactedPrompt }],
      options
    );

    // Track cost
    await this.costTracker.trackUsage({
      provider: this.provider.name,
      model: response.model,
      feature: 'chat',
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      responseTimeMs: response.responseTimeMs,
      cacheHit: false,
    });

    // Cache response
    await this.cache.set(cacheKey, response);

    return response;
  }

  async embed(text: string): Promise<number[]> {
    if (!this.provider) throw new Error('AI service not configured');

    // Check cache
    const cached = await this.cache.getCachedEmbedding(text);
    if (cached) return cached;

    // Generate embedding
    const embedding = await this.provider.embed(text);

    // Cache it
    await this.cache.setCachedEmbedding(text, embedding);

    return embedding;
  }

  getProvider(): AIProvider {
    if (!this.provider) throw new Error('AI service not configured');
    return this.provider;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.provider) return false;
    const health = await this.provider.healthCheck();
    return health.healthy;
  }
}

// Singleton instance
export const aiService = new AIServiceManager();
```

**Acceptance Criteria**:
- [ ] All provider implementations working
- [ ] Provider registry functional
- [ ] AI Service Manager can switch providers
- [ ] Basic health checks passing
- [ ] Unit tests for each provider

---

### Phase 1: Smart RCA Matching (Week 3-5)
**Goal**: Implement semantic similarity search for failures

#### Week 3: Vector Database Integration

**Task 1: Set up Weaviate**

`docker-compose.yml` (add to existing):
```yaml
services:
  weaviate:
    image: semitechnologies/weaviate:latest
    ports:
      - "8080:8080"
    environment:
      QUERY_DEFAULTS_LIMIT: 20
      AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: 'true'
      PERSISTENCE_DATA_PATH: './data'
      DEFAULT_VECTORIZER_MODULE: 'none'
      ENABLE_MODULES: ''
      CLUSTER_HOSTNAME: 'node1'
    volumes:
      - weaviate_data:/var/lib/weaviate

volumes:
  weaviate_data:
```

**Task 2: Define Schema**

`src/services/ai/vector/schema.ts`:
```typescript
import weaviate from 'weaviate-ts-client';

export const FAILURE_SCHEMA = {
  class: 'TestFailure',
  description: 'Test failures with embeddings for semantic search',
  vectorizer: 'none',  // We provide our own embeddings
  properties: [
    {
      name: 'testId',
      dataType: ['string'],
      description: 'Unique test identifier',
    },
    {
      name: 'testName',
      dataType: ['string'],
      description: 'Test name',
    },
    {
      name: 'errorMessage',
      dataType: ['text'],
      description: 'Error message from failure',
    },
    {
      name: 'stackTrace',
      dataType: ['text'],
      description: 'Stack trace',
    },
    {
      name: 'pipeline',
      dataType: ['string'],
    },
    {
      name: 'branch',
      dataType: ['string'],
    },
    {
      name: 'timestamp',
      dataType: ['date'],
    },
    {
      name: 'category',
      dataType: ['string'],
    },
    {
      name: 'resolution',
      dataType: ['text'],
    },
    {
      name: 'resolvedBy',
      dataType: ['string'],
    },
    {
      name: 'ticketUrl',
      dataType: ['string'],
    },
  ],
};

export async function initializeSchema(client: weaviate.Client): Promise<void> {
  const exists = await client.schema.exists('TestFailure');

  if (!exists) {
    await client.schema.classCreator().withClass(FAILURE_SCHEMA).do();
    console.log('✅ Vector DB schema created');
  }
}
```

**Task 3: Vector Client**

`src/services/ai/vector/client.ts`:
```typescript
import weaviate from 'weaviate-ts-client';
import { aiService } from '../manager';

export class VectorDBClient {
  private client: weaviate.Client;

  constructor() {
    this.client = weaviate.client({
      scheme: 'http',
      host: process.env.WEAVIATE_URL || 'localhost:8080',
    });
  }

  async initialize(): Promise<void> {
    await initializeSchema(this.client);
  }

  async indexFailure(failure: TestFailure): Promise<void> {
    // Generate embedding
    const text = `${failure.testName} ${failure.errorMessage} ${failure.stackTrace || ''}`;
    const embedding = await aiService.embed(text);

    // Store in Weaviate
    await this.client.data
      .creator()
      .withClassName('TestFailure')
      .withProperties({
        testId: failure.testId,
        testName: failure.testName,
        errorMessage: failure.errorMessage,
        stackTrace: failure.stackTrace,
        pipeline: failure.pipeline,
        branch: failure.branch,
        timestamp: failure.timestamp.toISOString(),
      })
      .withVector(embedding)
      .do();
  }

  async findSimilar(
    failure: TestFailure,
    limit: number = 5,
    minSimilarity: number = 0.75
  ): Promise<SimilarFailure[]> {
    // Generate embedding for query
    const text = `${failure.testName} ${failure.errorMessage}`;
    const embedding = await aiService.embed(text);

    // Search
    const results = await this.client.graphql
      .get()
      .withClassName('TestFailure')
      .withNearVector({ vector: embedding })
      .withLimit(limit)
      .withFields('testId testName errorMessage resolution resolvedBy ticketUrl timestamp _additional { distance }')
      .do();

    const failures = results.data.Get.TestFailure || [];

    return failures
      .map((item: any) => {
        const similarity = 1 - item._additional.distance;
        return {
          failure: {
            id: item.testId,
            testName: item.testName,
            errorMessage: item.errorMessage,
            resolution: item.resolution,
            resolvedBy: item.resolvedBy,
            ticketUrl: item.ticketUrl,
            timestamp: new Date(item.timestamp),
          },
          similarity,
          explanation: '',  // Will be generated by AI
        };
      })
      .filter(item => item.similarity >= minSimilarity);
  }

  async deleteFailure(failureId: string): Promise<void> {
    await this.client.data
      .deleter()
      .withClassName('TestFailure')
      .withWhere({
        path: ['testId'],
        operator: 'Equal',
        valueString: failureId,
      })
      .do();
  }
}

export const vectorDB = new VectorDBClient();
```

#### Week 4-5: RCA Matching Feature

**Task 1: RCA Matching Service**

`src/services/ai/features/rca-matching.ts`:
```typescript
import { aiService } from '../manager';
import { vectorDB } from '../vector/client';

export class RCAMatchingService {
  async findSimilarFailures(
    failure: TestFailure,
    options: {
      limit?: number;
      minSimilarity?: number;
    } = {}
  ): Promise<SimilarFailure[]> {
    const limit = options.limit || 5;
    const minSimilarity = options.minSimilarity || 0.75;

    // Find similar failures using vector search
    const similar = await vectorDB.findSimilar(failure, limit, minSimilarity);

    // Generate AI explanations for each match
    for (const match of similar) {
      match.explanation = await this.explainSimilarity(failure, match.failure);
    }

    return similar;
  }

  private async explainSimilarity(
    failure1: TestFailure,
    failure2: TestFailure
  ): Promise<string> {
    const prompt = `
Explain why these two test failures are similar:

Failure 1:
- Test: ${failure1.testName}
- Error: ${failure1.errorMessage}
- Date: ${failure1.timestamp}

Failure 2:
- Test: ${failure2.testName}
- Error: ${failure2.errorMessage}
- Date: ${failure2.timestamp}
- Resolution: ${failure2.resolution || 'Not resolved'}

Provide a concise explanation (2-3 sentences) focusing on the root cause similarity.
`;

    const response = await aiService.chat(prompt, {
      maxTokens: 200,
      temperature: 0.3,  // Lower temperature for consistent explanations
    });

    return response.content;
  }
}

export const rcaMatching = new RCAMatchingService();
```

**Task 2: REST API Endpoints**

`src/api/routes/ai/rca.routes.ts`:
```typescript
import { Router } from 'express';
import { rcaMatching } from '../../../services/ai/features/rca-matching';

const router = Router();

router.post('/find-similar', async (req, res) => {
  try {
    const { failureId, limit, minSimilarity } = req.body;

    // Get failure from database
    const failure = await db.getFailure(failureId);
    if (!failure) {
      return res.status(404).json({ error: 'Failure not found' });
    }

    // Find similar
    const similar = await rcaMatching.findSimilarFailures(failure, {
      limit,
      minSimilarity,
    });

    res.json({
      query: {
        failureId: failure.id,
        testName: failure.testName,
        errorMessage: failure.errorMessage,
      },
      similar,
      cached: false,
      responseTimeMs: Date.now() - req.startTime,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

**Task 3: CLI Command**

`src/cli/commands/ai/find-similar.ts`:
```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import { rcaMatching } from '../../../services/ai/features/rca-matching';

export const findSimilarCommand = new Command('find-similar')
  .description('Find similar historical failures')
  .argument('<failure-id>', 'Failure ID to search for')
  .option('-l, --limit <number>', 'Maximum results', '5')
  .option('-s, --similarity <number>', 'Minimum similarity threshold', '0.75')
  .action(async (failureId, options) => {
    console.log(chalk.blue('🔍 Finding similar failures...\n'));

    const failure = await db.getFailure(failureId);
    if (!failure) {
      console.log(chalk.red('❌ Failure not found'));
      return;
    }

    const similar = await rcaMatching.findSimilarFailures(failure, {
      limit: parseInt(options.limit),
      minSimilarity: parseFloat(options.similarity),
    });

    if (similar.length === 0) {
      console.log(chalk.yellow('No similar failures found'));
      return;
    }

    console.log(chalk.green(`Found ${similar.length} similar failures:\n`));

    similar.forEach((match, index) => {
      console.log(chalk.bold(`${index + 1}. ${match.failure.testName}`));
      console.log(chalk.gray(`   Similarity: ${(match.similarity * 100).toFixed(1)}%`));
      console.log(`   ${match.explanation}`);

      if (match.failure.resolution) {
        console.log(chalk.green(`   ✅ Resolution: ${match.failure.resolution}`));
      }

      if (match.failure.ticketUrl) {
        console.log(chalk.blue(`   🔗 ${match.failure.ticketUrl}`));
      }

      console.log();
    });
  });
```

**Acceptance Criteria**:
- [ ] Vector DB schema created
- [ ] Embeddings generated for failures
- [ ] Similarity search working
- [ ] AI explanations generated
- [ ] REST API endpoint functional
- [ ] CLI command working
- [ ] Integration tests passing

---

### Phase 2: Failure Categorization (Week 6-7)
**Goal**: AI-powered automatic categorization

*(Continuing with detailed implementation for remaining phases...)*

---

## 📝 Testing Strategy

### Unit Tests
```bash
npm test -- tests/ai/unit/
```

### Integration Tests
```bash
# Start dependencies
docker-compose up -d

# Run integration tests
npm test -- tests/ai/integration/
```

### E2E Tests
```bash
npm test -- tests/ai/e2e/
```

---

## 🚀 Deployment Checklist

- [ ] All environment variables configured
- [ ] Weaviate deployed and accessible
- [ ] Redis cache configured
- [ ] Database migrations run
- [ ] Provider API keys validated
- [ ] Cost tracking enabled
- [ ] Monitoring and alerts configured
- [ ] Documentation updated
- [ ] Beta users onboarded

---

## 📊 Success Metrics

Track these metrics after deployment:

- Time to identify similar failures: < 5 minutes (target)
- Categorization accuracy: > 85%
- AI feature adoption: > 70% of users
- Cost per user/month: < $10
- User satisfaction (NPS): > 50

---

*This implementation plan will be updated as we progress through each phase.*

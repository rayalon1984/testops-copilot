# AI Integration - API Design Specification

**Version**: 1.0
**Status**: Draft
**Owner**: Engineering
**Last Updated**: 2025-11-20

---

## 📋 Table of Contents

1. [TypeScript Interfaces](#typescript-interfaces)
2. [REST API Endpoints](#rest-api-endpoints)
3. [CLI Commands](#cli-commands)
4. [WebSocket Events](#websocket-events)
5. [GraphQL Schema](#graphql-schema)
6. [Error Codes](#error-codes)

---

## 🔷 TypeScript Interfaces

### Core Types

```typescript
// src/types/ai.ts

/**
 * Supported AI providers
 */
export type AIProviderName = 'anthropic' | 'openai' | 'google' | 'azure';

/**
 * AI feature categories
 */
export type AIFeature =
  | 'rca_matching'
  | 'categorization'
  | 'log_summary'
  | 'nl_query'
  | 'ticket_generation';

/**
 * Failure categories
 */
export type FailureCategory =
  | 'bug_critical'
  | 'bug_minor'
  | 'environment'
  | 'flaky'
  | 'configuration'
  | 'unknown';

/**
 * Configuration for AI provider
 */
export interface AIProviderConfig {
  provider: AIProviderName;
  apiKey: string;
  model?: string;
  endpoint?: string;  // For Azure
  organizationId?: string;  // For OpenAI
}

/**
 * AI service configuration
 */
export interface AIConfig {
  enabled: boolean;
  provider: AIProviderName;
  model: string;

  features: {
    rcaMatching: boolean;
    categorization: boolean;
    logSummary: boolean;
    nlQueries: boolean;
    ticketGeneration: boolean;
  };

  cost: {
    monthlyBudgetUSD: number;
    alertThresholdPercent: number;
    alertEmail?: string;
  };

  cache: {
    enabled: boolean;
    ttlSeconds: number;
  };

  rateLimit: {
    perMinute: number;
    perDay: number;
  };
}

/**
 * AI model information
 */
export interface AIModel {
  id: string;
  name: string;
  provider: AIProviderName;
  maxTokens: number;
  costPerInputToken: number;  // USD per token
  costPerOutputToken: number;
  capabilities: AIFeature[];
  description: string;
}

/**
 * Chat message
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Chat options
 */
export interface ChatOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

/**
 * AI response
 */
export interface AIResponse {
  content: string;
  provider: AIProviderName;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  cost: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
  };
  cached: boolean;
  responseTimeMs: number;
}

/**
 * Embedding vector
 */
export interface Embedding {
  vector: number[];
  model: string;
  dimensions: number;
}

/**
 * Test failure
 */
export interface TestFailure {
  id: string;
  testId: string;
  testName: string;
  errorMessage: string;
  stackTrace?: string;
  logSnippet?: string;

  pipeline: string;
  branch: string;
  commitHash: string;
  timestamp: Date;

  // Optional AI-generated fields
  embedding?: Embedding;
  category?: FailureCategory;
  categoryConfidence?: number;
  summary?: string;
}

/**
 * Similar failure match
 */
export interface SimilarFailure {
  failure: TestFailure;
  similarity: number;  // 0-1
  explanation: string;
  resolution?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  ticketUrl?: string;
}

/**
 * Failure categorization result
 */
export interface FailureCategorization {
  category: FailureCategory;
  confidence: number;  // 0-1
  reasoning: string;
  suggestedAction: string;
  relatedIssues?: string[];
}

/**
 * Log summary
 */
export interface LogSummary {
  summary: string;
  rootCause: string;
  errorLocation?: {
    file: string;
    line: number;
    snippet: string;
  };
  keyLogLines: Array<{
    lineNumber: number;
    content: string;
    relevance: 'high' | 'medium' | 'low';
  }>;
  suggestedFix: string;
  confidence: number;
}

/**
 * Natural language query result
 */
export interface NLQueryResult {
  query: string;
  answer: string;
  data?: any;
  visualization?: {
    type: 'bar' | 'line' | 'pie' | 'table';
    data: any;
  };
  sources: string[];
  confidence: number;
}

/**
 * Ticket generation request
 */
export interface TicketGenerationRequest {
  failureId: string;
  integrationPlatform: 'jira' | 'monday' | 'github';
  options?: {
    autoAssign?: boolean;
    priority?: 'low' | 'medium' | 'high' | 'critical';
  };
}

/**
 * Generated ticket
 */
export interface GeneratedTicket {
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  priority: 'low' | 'medium' | 'high' | 'critical';
  labels: string[];
  suggestedAssignee?: {
    name: string;
    reason: string;
  };
  relatedTickets: Array<{
    id: string;
    url: string;
    relation: string;
  }>;
  attachments: Array<{
    name: string;
    url: string;
    type: 'log' | 'screenshot' | 'stacktrace';
  }>;
}

/**
 * Cost summary
 */
export interface CostSummary {
  period: {
    start: Date;
    end: Date;
  };
  totalCost: number;
  totalRequests: number;
  totalTokens: number;
  byFeature: Array<{
    feature: AIFeature;
    cost: number;
    requests: number;
    tokens: number;
  }>;
  byProvider: Array<{
    provider: AIProviderName;
    cost: number;
    requests: number;
  }>;
  cacheHitRate: number;
  budgetUsed: number;  // Percentage
}

/**
 * Health status
 */
export interface HealthStatus {
  healthy: boolean;
  provider: AIProviderName;
  latencyMs: number;
  error?: string;
  lastChecked: Date;
}
```

---

## 🌐 REST API Endpoints

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication
All requests require authentication via Bearer token or API key:
```http
Authorization: Bearer <token>
```

---

### AI Configuration Endpoints

#### `GET /ai/config`
Get current AI configuration

**Response**:
```json
{
  "enabled": true,
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "features": {
    "rcaMatching": true,
    "categorization": true,
    "logSummary": true,
    "nlQueries": false,
    "ticketGeneration": true
  },
  "cost": {
    "monthlyBudgetUSD": 100,
    "currentSpend": 23.45,
    "alertThresholdPercent": 80
  },
  "health": {
    "healthy": true,
    "latencyMs": 245
  }
}
```

#### `PUT /ai/config`
Update AI configuration

**Request**:
```json
{
  "provider": "openai",
  "model": "gpt-4-turbo",
  "apiKey": "sk-xxxxx",
  "features": {
    "rcaMatching": true,
    "categorization": true
  }
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "AI configuration updated successfully"
}
```

#### `POST /ai/config/validate`
Validate AI provider configuration

**Request**:
```json
{
  "provider": "anthropic",
  "apiKey": "sk-ant-xxxxx",
  "model": "claude-sonnet-4-20250514"
}
```

**Response**: `200 OK`
```json
{
  "valid": true,
  "provider": "anthropic",
  "availableModels": [
    {
      "id": "claude-sonnet-4-20250514",
      "name": "Claude Sonnet 4",
      "costPerInputToken": 0.000003,
      "costPerOutputToken": 0.000015
    },
    {
      "id": "claude-opus-4-20250514",
      "name": "Claude Opus 4",
      "costPerInputToken": 0.000015,
      "costPerOutputToken": 0.000075
    }
  ]
}
```

---

### RCA Matching Endpoints

#### `POST /ai/rca/find-similar`
Find similar failures for a given failure

**Request**:
```json
{
  "failureId": "failure_123",
  "limit": 5,
  "minSimilarity": 0.75
}
```

**Response**: `200 OK`
```json
{
  "query": {
    "failureId": "failure_123",
    "testName": "test_user_authentication",
    "errorMessage": "Connection timeout to auth service"
  },
  "similar": [
    {
      "failure": {
        "id": "failure_045",
        "testName": "test_user_login",
        "errorMessage": "Auth service unreachable",
        "timestamp": "2024-10-15T14:30:00Z"
      },
      "similarity": 0.92,
      "explanation": "Both failures indicate auth service connectivity issues. The root cause in the previous case was a network firewall rule blocking the service port.",
      "resolution": "Updated firewall rules to allow traffic on port 8080",
      "resolvedBy": "john.doe@company.com",
      "ticketUrl": "https://jira.company.com/PROJ-2847"
    },
    {
      "failure": {
        "id": "failure_067",
        "testName": "test_authentication_flow",
        "errorMessage": "Timeout waiting for auth response",
        "timestamp": "2024-11-01T09:15:00Z"
      },
      "similarity": 0.87,
      "explanation": "Similar timeout issue. This was caused by auth service memory leak requiring restart.",
      "resolution": "Restarted auth service and increased memory limit",
      "resolvedBy": "jane.smith@company.com",
      "ticketUrl": "https://jira.company.com/PROJ-2901"
    }
  ],
  "cached": false,
  "responseTimeMs": 3245
}
```

#### `POST /ai/rca/explain-similarity`
Get detailed explanation of why two failures are similar

**Request**:
```json
{
  "failureId1": "failure_123",
  "failureId2": "failure_045"
}
```

**Response**: `200 OK`
```json
{
  "similarity": 0.92,
  "explanation": "Both failures show connection timeout errors to the authentication service. The error patterns suggest network connectivity issues rather than application bugs. Historical data shows these typically resolve with infrastructure changes.",
  "commonPatterns": [
    "Connection timeout",
    "Auth service",
    "Network issue"
  ],
  "differingFactors": [
    "Different test names",
    "Occurred in different pipelines"
  ],
  "confidence": 0.95
}
```

---

### Categorization Endpoints

#### `POST /ai/categorize/failure`
Categorize a single failure

**Request**:
```json
{
  "failureId": "failure_123"
}
```

**Response**: `200 OK`
```json
{
  "category": "environment",
  "confidence": 0.92,
  "reasoning": "The failure shows a service timeout pattern that occurs intermittently across multiple tests. Log analysis indicates the auth service was experiencing high load during this time. This is characteristic of an infrastructure issue rather than a code bug.",
  "suggestedAction": "Check auth service health and scaling policies. Consider increasing instance count or memory limits.",
  "relatedIssues": [
    "INFRA-445: Auth service memory pressure",
    "INFRA-401: Load balancer timeout issues"
  ],
  "cached": false,
  "responseTimeMs": 1842
}
```

#### `POST /ai/categorize/batch`
Categorize multiple failures in batch

**Request**:
```json
{
  "failureIds": ["failure_123", "failure_124", "failure_125"]
}
```

**Response**: `200 OK`
```json
{
  "results": [
    {
      "failureId": "failure_123",
      "category": "environment",
      "confidence": 0.92
    },
    {
      "failureId": "failure_124",
      "category": "bug_critical",
      "confidence": 0.88
    },
    {
      "failureId": "failure_125",
      "category": "flaky",
      "confidence": 0.75
    }
  ],
  "summary": {
    "total": 3,
    "byCategory": {
      "environment": 1,
      "bug_critical": 1,
      "flaky": 1
    }
  }
}
```

---

### Log Summarization Endpoints

#### `POST /ai/logs/summarize`
Summarize log content

**Request**:
```json
{
  "failureId": "failure_123",
  "maxLines": 5000
}
```

**Response**: `200 OK`
```json
{
  "summary": "The test failed due to a connection timeout when attempting to reach the authentication service on port 8080. The service appears to be running but not responding to requests within the 5-second timeout window.",
  "rootCause": "Auth service is experiencing high memory pressure (95% utilization) causing slow response times and eventual timeouts.",
  "errorLocation": {
    "file": "auth-client.ts",
    "line": 142,
    "snippet": "await fetch(`${authServiceUrl}/verify`, { timeout: 5000 })"
  },
  "keyLogLines": [
    {
      "lineNumber": 1247,
      "content": "ERROR: Connection timeout to http://auth-service:8080/verify",
      "relevance": "high"
    },
    {
      "lineNumber": 1198,
      "content": "WARN: Auth service response time: 4823ms (threshold: 3000ms)",
      "relevance": "high"
    },
    {
      "lineNumber": 892,
      "content": "INFO: Memory usage: 95.3% (1.9GB / 2GB)",
      "relevance": "medium"
    }
  ],
  "suggestedFix": "Increase auth service memory limit from 2GB to 4GB or optimize memory usage. Also consider increasing client timeout from 5s to 10s as temporary measure.",
  "confidence": 0.88,
  "cached": false,
  "responseTimeMs": 8234
}
```

#### `POST /ai/logs/summarize/stream`
Stream log summary (for real-time display)

**Request**:
```json
{
  "failureId": "failure_123"
}
```

**Response**: `200 OK` (Server-Sent Events)
```
event: start
data: {"status": "Processing log..."}

event: chunk
data: {"content": "The test failed due to a connection timeout"}

event: chunk
data: {"content": " when attempting to reach the authentication service"}

event: complete
data: {"summary": "...", "rootCause": "...", "keyLogLines": [...]}
```

---

### Natural Language Query Endpoints

#### `POST /ai/query`
Query test data using natural language

**Request**:
```json
{
  "query": "What are the most common failures in the last week?",
  "context": {
    "teamId": "team_123",
    "timeRange": {
      "start": "2024-11-13T00:00:00Z",
      "end": "2024-11-20T00:00:00Z"
    }
  }
}
```

**Response**: `200 OK`
```json
{
  "query": "What are the most common failures in the last week?",
  "answer": "In the last week, the most common failure was 'test_authentication_flow' which failed 47 times (23% of all failures). This was followed by 'test_payment_integration' with 31 failures (15%) and 'test_checkout_process' with 28 failures (14%). The authentication failures are primarily environment-related (connection timeouts), while payment failures are a mix of real bugs and configuration issues.",
  "data": {
    "totalFailures": 205,
    "topFailures": [
      {
        "testName": "test_authentication_flow",
        "count": 47,
        "percentage": 23
      },
      {
        "testName": "test_payment_integration",
        "count": 31,
        "percentage": 15
      },
      {
        "testName": "test_checkout_process",
        "count": 28,
        "percentage": 14
      }
    ]
  },
  "visualization": {
    "type": "bar",
    "data": {
      "labels": ["test_authentication_flow", "test_payment_integration", "test_checkout_process"],
      "values": [47, 31, 28]
    }
  },
  "sources": [
    "test_results table (205 records)",
    "failure_categorizations table"
  ],
  "confidence": 0.95,
  "responseTimeMs": 4521
}
```

---

### Ticket Generation Endpoints

#### `POST /ai/tickets/generate`
Generate ticket content for a failure

**Request**:
```json
{
  "failureId": "failure_123",
  "platform": "jira",
  "options": {
    "autoAssign": true,
    "priority": "high"
  }
}
```

**Response**: `200 OK`
```json
{
  "title": "Auth service connection timeouts in test_authentication_flow",
  "description": "## Summary\n\nThe test `test_authentication_flow` is consistently failing due to connection timeouts when attempting to reach the authentication service.\n\n## Details\n\n- **Test**: test_authentication_flow\n- **Error**: Connection timeout to auth service\n- **Occurrences**: 47 times in the last 7 days\n- **First seen**: 2024-11-13\n- **Pipeline**: CI-Main\n- **Branch**: main\n\n## Root Cause\n\nAI Analysis indicates this is an **environment issue** (92% confidence). The auth service is experiencing high memory pressure (95% utilization) causing slow response times.\n\n## Related Issues\n\n- [INFRA-445](https://jira.company.com/INFRA-445) - Similar auth service timeouts\n- [PROJ-2847](https://jira.company.com/PROJ-2847) - Resolved by updating firewall rules\n\n## Suggested Fix\n\n1. Increase auth service memory limit from 2GB to 4GB\n2. Consider increasing client timeout from 5s to 10s as temporary measure\n3. Review auth service logs for memory leaks\n\n## Logs\n\nSee attached: `failure_123_logs.txt`",
  "severity": "high",
  "priority": "high",
  "labels": ["environment", "auth-service", "timeout", "flaky-test"],
  "suggestedAssignee": {
    "name": "devops-team",
    "reason": "This is an infrastructure issue. The DevOps team previously resolved similar auth service issues."
  },
  "relatedTickets": [
    {
      "id": "INFRA-445",
      "url": "https://jira.company.com/INFRA-445",
      "relation": "Similar auth service timeout issue"
    },
    {
      "id": "PROJ-2847",
      "url": "https://jira.company.com/PROJ-2847",
      "relation": "Previous resolution involved firewall rules"
    }
  ],
  "attachments": [
    {
      "name": "failure_123_logs.txt",
      "url": "/api/v1/failures/failure_123/logs",
      "type": "log"
    },
    {
      "name": "stacktrace.txt",
      "url": "/api/v1/failures/failure_123/stacktrace",
      "type": "stacktrace"
    }
  ]
}
```

#### `POST /ai/tickets/create`
Generate and create ticket in external platform

**Request**:
```json
{
  "failureId": "failure_123",
  "platform": "jira",
  "projectKey": "PROJ",
  "options": {
    "autoAssign": true
  }
}
```

**Response**: `201 Created`
```json
{
  "ticketId": "PROJ-3042",
  "ticketUrl": "https://jira.company.com/PROJ-3042",
  "created": true,
  "assignedTo": "devops-team"
}
```

---

### Cost & Usage Endpoints

#### `GET /ai/costs/summary`
Get cost summary for current month

**Query Parameters**:
- `teamId` (optional): Filter by team
- `start` (optional): Start date (ISO 8601)
- `end` (optional): End date (ISO 8601)

**Response**: `200 OK`
```json
{
  "period": {
    "start": "2024-11-01T00:00:00Z",
    "end": "2024-11-20T23:59:59Z"
  },
  "totalCost": 23.45,
  "totalRequests": 1247,
  "totalTokens": 892341,
  "byFeature": [
    {
      "feature": "rca_matching",
      "cost": 12.34,
      "requests": 523,
      "tokens": 456123
    },
    {
      "feature": "categorization",
      "cost": 7.89,
      "requests": 487,
      "tokens": 298456
    },
    {
      "feature": "log_summary",
      "cost": 3.22,
      "requests": 237,
      "tokens": 137762
    }
  ],
  "byProvider": [
    {
      "provider": "anthropic",
      "cost": 23.45,
      "requests": 1247
    }
  ],
  "cacheHitRate": 64.3,
  "budget": {
    "limit": 100,
    "used": 23.45,
    "percentUsed": 23.45,
    "remaining": 76.55
  }
}
```

#### `GET /ai/health`
Check AI service health

**Response**: `200 OK`
```json
{
  "healthy": true,
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "latencyMs": 245,
  "lastChecked": "2024-11-20T12:34:56Z",
  "vectorDB": {
    "healthy": true,
    "indexed": 5247,
    "latencyMs": 32
  },
  "cache": {
    "healthy": true,
    "hitRate": 64.3
  }
}
```

---

## 💻 CLI Commands

### Configuration Commands

#### `testops ai configure`
Interactive AI configuration wizard

```bash
$ testops ai configure

🤖 AI Configuration Wizard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Choose your AI provider:
  1. Anthropic Claude (recommended)
  2. OpenAI GPT-4
  3. Google Gemini
  4. Azure OpenAI
  5. Skip (disable AI features)

Your choice [1]: 1

Enter your Anthropic API key: sk-ant-xxxxx

✅ Testing connection... Success!

Choose model:
  1. Claude Sonnet 4 (fast, balanced) - $3/M tokens
  2. Claude Opus 4 (most capable) - $15/M tokens

Your choice [1]: 1

Set monthly budget (USD) [100]: 100

✅ AI configured successfully!

Features enabled:
  ✅ Smart RCA matching
  ✅ Failure categorization
  ✅ Log summarization
  ✅ Intelligent ticket creation
  ⏸️  Natural language queries (coming soon)

Cost estimate: ~$5/month per active user
```

#### `testops ai status`
Show AI service status

```bash
$ testops ai status

🤖 TestOps Companion - AI Service Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Status: ✅ Operational
Provider: Anthropic Claude
Model: claude-sonnet-4-20250514
Latency: 245ms

💰 Cost Summary (This Month)
  Total: $23.45 / $100.00 (23%)
  Requests: 1,247
  Cache hit rate: 64.3%

📊 Usage by Feature
  RCA Matching: $12.34 (523 requests)
  Categorization: $7.89 (487 requests)
  Log Summary: $3.22 (237 requests)

🔍 Vector Database
  Status: ✅ Healthy
  Indexed: 5,247 failures
  Latency: 32ms
```

#### `testops ai switch-provider`
Switch to a different AI provider

```bash
$ testops ai switch-provider openai

Switching to OpenAI...

Enter your OpenAI API key: sk-xxxxx

✅ Testing connection... Success!

Available models:
  1. gpt-4-turbo (recommended)
  2. gpt-4
  3. gpt-3.5-turbo

Your choice [1]: 1

✅ Switched to OpenAI GPT-4 Turbo

Note: Your existing embeddings will be regenerated with the new provider.
This may take a few minutes.
```

---

### Analysis Commands

#### `testops ai analyze <failure-id>`
Analyze a specific failure with AI

```bash
$ testops ai analyze failure_123

🔍 Analyzing failure: test_authentication_flow
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ Error: Connection timeout to auth service

🤖 AI Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Category: Environment Issue (92% confidence)

Reasoning: The failure shows a service timeout pattern that occurs
intermittently. Log analysis indicates high memory pressure on the
auth service. This is characteristic of infrastructure issues.

Root Cause: Auth service experiencing memory pressure (95% utilization)

Suggested Action:
  1. Increase auth service memory limit (2GB → 4GB)
  2. Temporarily increase client timeout (5s → 10s)
  3. Review for memory leaks

🔗 Similar Failures (Found 2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. failure_045 (92% similar)
   → "Auth service unreachable"
   → Resolved: Updated firewall rules
   → Ticket: PROJ-2847

2. failure_067 (87% similar)
   → "Timeout waiting for auth response"
   → Resolved: Restarted service, increased memory
   → Ticket: PROJ-2901

💡 Suggested Actions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  testops ai create-ticket failure_123
  testops logs view failure_123 --summary
```

#### `testops ai find-similar <failure-id>`
Find similar historical failures

```bash
$ testops ai find-similar failure_123

🔍 Finding similar failures...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Found 5 similar failures:

1. failure_045 (92% similar) - 35 days ago
   Test: test_user_login
   Error: Auth service unreachable

   Why similar: Both show auth service connectivity issues
   Resolution: Updated firewall rules to allow port 8080
   Resolved by: john.doe@company.com
   Ticket: PROJ-2847

2. failure_067 (87% similar) - 19 days ago
   Test: test_authentication_flow
   Error: Timeout waiting for auth response

   Why similar: Same timeout pattern, memory leak in auth service
   Resolution: Restarted service and increased memory limit
   Resolved by: jane.smith@company.com
   Ticket: PROJ-2901

[... 3 more ...]

💡 Tip: Use `testops rca view <failure-id>` to see full RCA details
```

#### `testops ai summarize-logs <failure-id>`
Get AI summary of failure logs

```bash
$ testops ai summarize-logs failure_123

📜 Summarizing 5,247 lines of logs...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The test failed due to connection timeout when reaching the auth
service on port 8080. The service is running but not responding
within the 5-second timeout window.

🔍 Root Cause
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Auth service is experiencing high memory pressure (95% utilization)
causing slow response times and eventual timeouts.

📍 Error Location
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: auth-client.ts
Line: 142
Code: await fetch(`${authServiceUrl}/verify`, { timeout: 5000 })

🔑 Key Log Lines
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Line 1247: ERROR: Connection timeout to http://auth-service:8080/verify
Line 1198: WARN: Auth service response time: 4823ms (threshold: 3000ms)
Line 892:  INFO: Memory usage: 95.3% (1.9GB / 2GB)

💡 Suggested Fix
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Increase auth service memory limit from 2GB to 4GB or optimize
memory usage. Consider increasing client timeout from 5s to 10s
as temporary measure.

Confidence: 88%

💾 Full logs: testops logs view failure_123
```

#### `testops ai create-ticket <failure-id>`
Generate and create ticket for failure

```bash
$ testops ai create-ticket failure_123

🎫 Generating ticket...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Title: Auth service connection timeouts in test_authentication_flow

Platform: Jira
Project: PROJ
Severity: High
Priority: High
Labels: environment, auth-service, timeout

Suggested assignee: devops-team
  Reason: Infrastructure issue. DevOps team resolved similar issues before.

Related tickets:
  • INFRA-445 - Similar auth timeout
  • PROJ-2847 - Previous firewall resolution

Preview ticket? (y/N): y

[Shows full ticket preview...]

Create this ticket? (Y/n): y

✅ Ticket created: PROJ-3042
   https://jira.company.com/PROJ-3042

✅ Attached logs and stacktrace
✅ Linked to related tickets
✅ Assigned to devops-team
```

---

### Query Commands

#### `testops ai ask "<question>"`
Ask questions in natural language

```bash
$ testops ai ask "What's the most common failure this week?"

🤖 Analyzing test data...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Question: What's the most common failure this week?

Answer:
The most common failure this week was 'test_authentication_flow'
which failed 47 times (23% of all failures). This was followed by
'test_payment_integration' with 31 failures (15%).

The authentication failures are primarily environment-related
(connection timeouts), while payment failures are a mix of real
bugs and configuration issues.

📊 Chart
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test_authentication_flow  ████████████████████████ 47
test_payment_integration  ███████████████          31
test_checkout_process     █████████████            28

💡 Follow-up questions:
  • "Why is test_authentication_flow failing?"
  • "Show me the trend for authentication failures"
  • "Which team owns the auth service?"
```

---

### Cost Commands

#### `testops ai costs`
View AI cost breakdown

```bash
$ testops ai costs

💰 AI Cost Summary - November 2024
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total: $23.45 / $100.00 (23.45%)

By Feature:
  RCA Matching          $12.34  (523 requests)  ████████████
  Categorization        $7.89   (487 requests)  ████████
  Log Summarization     $3.22   (237 requests)  ███

By Day:
  Nov 13  $0.89   █
  Nov 14  $1.45   ██
  Nov 15  $2.34   ███
  Nov 16  $1.89   ██
  Nov 17  $3.12   ████
  Nov 18  $4.56   ██████
  Nov 19  $5.23   ███████
  Nov 20  $3.97   █████

Cache Performance:
  Hit rate: 64.3%
  Savings: ~$18.50

Estimated end-of-month: $35.20 ✅ Under budget
```

---

## 🔌 WebSocket Events

For real-time AI updates:

```typescript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:3000/ws');

// Subscribe to AI events
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: ['ai.analysis', 'ai.costs']
}));

// Listen for events
ws.on('message', (data) => {
  const event = JSON.parse(data);

  switch (event.type) {
    case 'ai.analysis.started':
      console.log('AI analysis started', event.failureId);
      break;

    case 'ai.analysis.completed':
      console.log('AI analysis completed', event.result);
      break;

    case 'ai.cost.alert':
      console.log('Cost alert', event.message);
      break;
  }
});
```

**Event Types**:
- `ai.analysis.started` - AI analysis initiated
- `ai.analysis.progress` - Streaming progress
- `ai.analysis.completed` - Analysis finished
- `ai.cost.alert` - Budget threshold reached
- `ai.provider.error` - Provider error occurred

---

## 🔢 Error Codes

| Code | Message | Description |
|------|---------|-------------|
| `AI_001` | AI service not configured | API key missing or invalid |
| `AI_002` | Provider not available | Selected provider is down |
| `AI_003` | Budget exceeded | Monthly budget limit reached |
| `AI_004` | Rate limit exceeded | Too many requests |
| `AI_005` | Invalid model | Requested model not supported |
| `AI_006` | Embedding generation failed | Vector generation error |
| `AI_007` | Vector search failed | Database query error |
| `AI_008` | Prompt too large | Input exceeds token limit |
| `AI_009` | Cache error | Redis connection failed |
| `AI_010` | Feature disabled | Requested feature not enabled |

---

## ✅ Implementation Checklist

- [ ] Implement core TypeScript interfaces
- [ ] Build REST API endpoints
- [ ] Create CLI commands
- [ ] Add WebSocket support
- [ ] Write comprehensive tests
- [ ] Document error handling
- [ ] Add rate limiting
- [ ] Implement caching
- [ ] Create usage examples
- [ ] Build Postman collection

---

*This API specification will evolve during implementation. All breaking changes require versioning.*

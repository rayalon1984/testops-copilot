/**
 * AI Integration - Core Type Definitions
 *
 * This file contains all TypeScript interfaces and types for the AI integration.
 * Based on the AI Integration API specification.
 */

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
  provider?: AIProviderName;
  latencyMs?: number;
  error?: string;
  lastChecked?: Date;
  services?: {
    provider?: {
      healthy: boolean;
      name?: string;
      error?: string;
    };
    vectorDB?: {
      healthy: boolean;
      error?: string;
    };
    cache?: {
      healthy: boolean;
      stats?: {
        hits: number;
        misses: number;
        hitRate: number;
      };
    };
  };
}

/**
 * Usage tracking entry
 */
export interface UsageEntry {
  userId: string;
  teamId: string;
  provider: AIProviderName;
  model: string;
  feature: AIFeature;
  inputTokens: number;
  outputTokens: number;
  responseTimeMs: number;
  cacheHit: boolean;
  timestamp: Date;
}

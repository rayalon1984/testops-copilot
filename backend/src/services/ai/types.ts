/**
 * AI Integration - Core Type Definitions
 *
 * This file contains all TypeScript interfaces and types for the AI integration.
 * Based on the AI Integration API specification.
 */

import { ToolSchema } from './tools/types';

/**
 * Supported AI providers
 */
export type AIProviderName = 'anthropic' | 'openai' | 'google' | 'azure' | 'openrouter' | 'bedrock' | 'mock';

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

  providerSettings: {
    maxTokens: number;
    temperature: number;
    timeoutMs: number;
  };

  /**
   * Context window management settings.
   * Controls token budgeting to prevent context overflow.
   */
  contextWindow?: {
    /** Override the model's context window size (auto-detected if omitted) */
    sizeOverride?: number;
    /** Maximum tokens for a single tool result (default: auto per model tier) */
    maxToolResultTokens?: number;
    /** Maximum total tokens for all tool results (default: auto per model tier) */
    maxTotalToolResultTokens?: number;
  };

  /**
   * Small model / on-prem configuration.
   * When set, basic features (categorization, flaky detection) use this model
   * instead of the primary model, enabling on-prem analysis without cloud calls.
   */
  localModel?: {
    /** Enable local model routing for basic features */
    enabled: boolean;
    /** Provider for the local model (typically 'openrouter' pointed at a local endpoint) */
    provider: AIProviderName;
    /** Model ID (e.g. 'meta-llama/llama-3.2-3b-instruct') */
    model: string;
    /** Optional: override the base URL for self-hosted inference */
    baseUrl?: string;
  };

  providerSecrets: {
    anthropicApiKey?: string;
    openaiApiKey?: string;
    openaiOrgId?: string;
    googleApiKey?: string;
    azureOpenaiKey?: string;
    azureOpenaiEndpoint?: string;
    azureDeploymentName?: string;
    openrouterApiKey?: string;
    openrouterSiteUrl?: string;
    openrouterAppName?: string;
    bedrockRegion?: string;
    bedrockAccessKeyId?: string;
    bedrockSecretAccessKey?: string;
    bedrockEmbeddingModel?: string;
  };

  vectorDB: {
    url: string;
    apiKey?: string;
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
 * Tool call definition
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Chat message
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolOnly?: boolean; // If true, content is ignored (for pure tool calls)
  toolCalls?: ToolCall[]; // For assistant messages
  toolCallId?: string; // For tool results
  name?: string; // For tool results (tool name)
}

/**
 * Chat options
 */
export interface ChatOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  tools?: ToolSchema[]; // Tool definitions
}

/**
 * AI response
 */
export interface AIResponse {
  content: string;
  toolCalls?: ToolCall[];
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

  // Optional Xray mapping
  externalTestCaseId?: string;

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
  data?: unknown;
  visualization?: {
    type: 'bar' | 'line' | 'pie' | 'table';
    data: unknown;
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

/**
 * Type definitions for TestOps MCP Server
 */

export interface TestFailure {
  testName: string;
  errorMessage: string;
  stackTrace?: string;
  logs?: string;
  category?: string;
  pipeline?: string;
  branch?: string;
  timestamp?: Date;
}

export interface SimilarFailure {
  id: string;
  testName: string;
  errorMessage: string;
  similarity: number;
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  ticketUrl?: string;
  occurrences: number;
}

export interface AnalysisResult {
  categorization: {
    category: string;
    subcategory?: string;
    confidence: number;
    reasoning: string;
  };
  similarFailures: SimilarFailure[];
  logSummary?: {
    summary: string;
    rootCause: string;
    technicalDetails: string;
    suggestedFix: string;
  };
  estimatedCostUSD: number;
}

export interface BatchAnalysisResult {
  totalFailures: number;
  analyzedFailures: number;
  summary: string;
  patterns: {
    category: string;
    count: number;
    examples: string[];
  }[];
  priorities: {
    high: TestFailure[];
    medium: TestFailure[];
    low: TestFailure[];
  };
  estimatedTotalCostUSD: number;
}

export interface KnowledgeEntry {
  id: string;
  testName: string;
  errorMessage: string;
  category: string;
  resolution: string;
  resolvedBy: string;
  ticketUrl?: string;
  createdAt: Date;
  similarity?: number;
}

export interface PipelineStats {
  id: string;
  name: string;
  type: string;
  recentRuns: {
    id: string;
    status: string;
    startedAt: Date;
    duration?: number;
    failed: number;
  }[];
  successRate: number;
  avgDuration: number;
  commonFailures: {
    testName: string;
    count: number;
    lastOccurrence: Date;
  }[];
}

export interface TestHistory {
  testName: string;
  totalRuns: number;
  failures: number;
  flakinessScore: number;
  failurePatterns: {
    errorMessage: string;
    count: number;
    lastOccurrence: Date;
  }[];
  recentRuns: {
    id: string;
    status: string;
    timestamp: Date;
    pipeline: string;
    branch: string;
  }[];
}

export interface CostStats {
  period: {
    start: Date;
    end: Date;
  };
  totalCostUSD: number;
  breakdown: {
    feature: string;
    calls: number;
    totalTokens: number;
    costUSD: number;
  }[];
  topExpensiveOperations: {
    timestamp: Date;
    feature: string;
    costUSD: number;
    tokens: number;
  }[];
}

export interface HealthStatus {
  healthy: boolean;
  services: {
    database?: { healthy: boolean; error?: string };
    aiProvider?: { healthy: boolean; name?: string; error?: string };
    vectorDB?: { healthy: boolean; error?: string };
    cache?: { healthy: boolean; stats?: any };
  };
}

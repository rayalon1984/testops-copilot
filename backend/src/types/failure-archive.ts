/**
 * Types for Failure Archive & Root Cause Analysis
 */

export enum FailureStatus {
  NEW = 'NEW',
  INVESTIGATING = 'INVESTIGATING',
  DOCUMENTED = 'DOCUMENTED',
  RESOLVED = 'RESOLVED',
  RECURRING = 'RECURRING'
}

export enum FailureSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export interface FailureArchive {
  id: string;
  testRunId: string;
  testCaseId?: string;
  testName: string;
  failureSignature: string;

  // Failure details
  errorMessage: string;
  errorType?: string;
  stackTrace?: string;
  logSnippet?: string;
  screenshots: string[];

  // Temporal data
  occurredAt: Date;
  environment?: string;
  buildNumber?: string;
  commitSha?: string;
  branch?: string;

  // RCA Documentation
  rootCause?: string;
  detailedAnalysis?: string;
  solution?: string;
  preventionSteps?: string;
  workaround?: string;
  relatedDocumentation: string[];

  // Resolution tracking
  status: FailureStatus;
  resolvedAt?: Date;
  resolvedBy?: string;
  timeToResolve?: number;

  // Integration links
  jiraIssueId?: string;
  jiraIssueKey?: string;
  prUrl?: string;

  // Pattern detection
  isRecurring: boolean;
  firstSeenAt: Date;
  lastSeenAt: Date;
  occurrenceCount: number;
  recurrencePattern?: string;

  // Metadata
  tags: string[];
  severity: FailureSeverity;
  isKnownIssue: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface FailurePattern {
  id: string;
  signature: string;
  patternName: string;
  description: string;
  affectedTests: string[];
  commonRootCause?: string;
  matchCount: number;
  lastMatched: Date;
  recurrenceRule?: string;
  confidence: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFailureArchiveInput {
  testRunId: string;
  testCaseId?: string;
  testName: string;
  errorMessage: string;
  errorType?: string;
  stackTrace?: string;
  logSnippet?: string;
  screenshots?: string[];
  environment?: string;
  buildNumber?: string;
  commitSha?: string;
  branch?: string;
  severity?: FailureSeverity;
  tags?: string[];
}

export interface DocumentRCAInput {
  id: string;
  rootCause: string;
  detailedAnalysis?: string;
  solution?: string;
  preventionSteps?: string;
  workaround?: string;
  relatedDocumentation?: string[];
  jiraIssueKey?: string;
  prUrl?: string;
  tags?: string[];
  resolvedBy?: string;
  timeToResolve?: number;
}

export interface SearchFailuresQuery {
  testName?: string;
  errorMessage?: string;
  status?: FailureStatus;
  severity?: FailureSeverity;
  isRecurring?: boolean;
  isKnownIssue?: boolean;
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface SimilarFailure {
  failure: FailureArchive;
  similarity: number;
  matchType: 'exact' | 'fuzzy' | 'pattern';
  matchReason: string;
}

export interface FailureInsights {
  totalFailures: number;
  documentedCount: number;
  recurringCount: number;
  averageTimeToResolve: number;
  mostCommonFailures: Array<{
    testName: string;
    count: number;
    lastOccurrence: Date;
  }>;
  recentPatterns: FailurePattern[];
}

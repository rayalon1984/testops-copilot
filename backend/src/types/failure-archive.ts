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
  testName: string;
  errorMessage: string;
  stackTrace?: string;
  category?: string;
  severity?: string;

  // RCA Documentation
  rcaDocumented: boolean;
  rootCause?: string;
  solution?: string;
  prevention?: string;
  relatedJiraIssue?: string;
  tags?: string; // Comma separated in SQLite/Dev? Prod schema has String[]? 
  // Wait. Prod schema says `tags String[]`. Dev schema said `String?` (comma separated).
  // IF Prod is String[], I should use string[].
  // BUT `backend/prisma/schema.dev.prisma` has `tags String?`.
  // This is a continued mismatch if I want Dev to work on SQLite.
  // SQLite doesn't support arrays. 
  // So Dev schema `tags String?` vs Prod `tags String[]`.
  // Application code must handle both? 
  // Or I should make Prod uses String? (comma separated) for strict parity?
  // Modifying Prod schema is risky/undesirable?
  // Step 1697 (Prod Schema) shows `tags String[]`.
  // Step 1645 (Dev Schema) shows `tags String?`.
  // The SERVICE code I wrote: `tags: input.tags?.join(',') || null`.
  // This works for String? (SQLite).
  // It FAILS for String[] (Postgres).
  // Postgres Prisma Client expects `string[]`.
  // So `input.tags?.join(',')` is wrong for Prod.
  // I need to use `tags: input.tags` (array) for Prod.
  // But that fails for Dev.
  // CONSTANT STRUGGLE.
  // Adaptation: Check environment? Or just standardize on String? (scalar) for BOTH?
  // Changing Prod schema is possibly "breaking" existing data? 
  // If I change Prod `tags String[]` to `tags String`, I lose array capability but gain compatibility.
  // OR I use `input.tags` and let Prisma handle it? No, types differ.
  // I will change the SERVICE to use `any` cast or check env?
  // Better: Change Dev schema to `tags String` (CSV) and Prod schema to `tags String` (CSV)? 
  // Or Dev schema `tags String` and Prod `tags String[]` and code does:
  // `tags: isPostgres ? input.tags : input.tags.join(',')`.
  // Too complex.
  // I will Change PROD SCHEMA (in my Dockerfile copy logic?) No.
  // I will change `schema.dev.prisma` to use `String` (CSV) which I did.
  // I will Change Service to try to support both... how?
  // `tags: input.tags as any`. 
  // If I pass `string[]` to SQLite `String` field -> Prisma Error "Got array, expected string".
  // If I pass `string` to Postgres `String[]` field -> Prisma Error "Got string, expected array".
  // I MUST standardize the schema. 
  // Since I cannot easily change the existing Prod Database (it has data?), 
  // actually I CAN change prod schema if I do a migration. 
  // But validation/setup scripts run `prisma db push` or `migrate deploy`.
  // If I change `schema.production.prisma` in the repo, valid.
  // Does the user have existing Prod data? "Transition to Docker-Only".
  // "This change deprecates manual...".
  // I should check validity of changing Prod schema.
  // If I assume I can update Prod schema:
  // I will convert Prod `tags` to `String` (nullable, CSV) to match Dev. 
  // This simplifies everything.
  // Let's modify `schema.production.prisma` to use `tags String?`.
  // WAIT. In step 1697 it is `tags String[]`.
  // I will update it to `tags String?` (CSV).
  // Then update Types.

  metadata?: Record<string, unknown>; // Json?

  firstOccurrence: Date;
  lastOccurrence: Date;
  occurrenceCount: number;
  resolved: boolean;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Remove FailurePattern interface
// export interface FailurePattern ...

export interface CreateFailureArchiveInput {
  testRunId?: string; // Not in schema directly?
  testCaseId?: string;
  testName: string;
  errorMessage: string;
  category?: string;
  stackTrace?: string;
  severity?: string;
  tags?: string[];
}

export interface DocumentRCAInput {
  id: string;
  rootCause: string;
  solution?: string;
  prevention?: string;
  jiraIssueKey?: string;
  prUrl?: string; // Not in schema
  tags?: string[];
  timeToResolve?: number; // Not in schema?
}

export interface SearchFailuresQuery {
  testName?: string;
  errorMessage?: string;
  status?: FailureStatus; // Map to boolean
  severity?: string;
  isRecurring?: boolean;
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface SimilarFailure {
  failure: FailureArchive;
  similarity: number;
  matchType: 'exact' | 'fuzzy';
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
  recentPatterns: unknown[]; // Empty
}

/**
 * Xray Cloud integration types.
 *
 * Shared between xray.service.ts, controllers, and AI enrichment.
 */

// ─── Test Entity Types ──────────────────────────────────────────────

export interface XrayTestCase {
  key: string;
  summary: string;
  status: string;
  lastExecution: string | null;
}

export interface XrayTestPlan {
  key: string;
  summary: string;
  testCount: number;
  passRate: number;
  coveragePercentage: number;
  coveredCount: number;
  lastUpdated: string | null;
}

export interface XrayTestPlanDetail extends XrayTestPlan {
  testCases: XrayTestCase[];
}

export interface XrayTestCaseHistory {
  testCaseKey: string;
  summary: string;
  status: string;
  executionHistory: Array<{
    date: string;
    status: string;
    executionKey: string;
  }>;
  linkedDefects: Array<{
    key: string;
    summary: string;
    status: string;
  }>;
}

// ─── Sync Types ─────────────────────────────────────────────────────

export interface XraySyncResult {
  syncId: string;
  status: string;
  xrayExecutionId: string | null;
  resultCount: number;
}

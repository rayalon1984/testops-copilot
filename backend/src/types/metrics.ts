/**
 * Prometheus Metrics Types
 *
 * Type definitions for Prometheus metrics export
 */

export interface MetricLabel {
  [key: string]: string;
}

export interface Metric {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  value: number;
  labels?: MetricLabel;
}

export interface HistogramBucket {
  le: number; // Less than or equal to
  count: number;
}

export interface HistogramMetric extends Metric {
  type: 'histogram';
  buckets: HistogramBucket[];
  sum: number;
  count: number;
}

export interface SummaryQuantile {
  quantile: number;
  value: number;
}

export interface SummaryMetric extends Metric {
  type: 'summary';
  quantiles: SummaryQuantile[];
  sum: number;
  count: number;
}

export interface TestMetrics {
  // Test Run Metrics
  totalTestRuns: number;
  passedTestRuns: number;
  failedTestRuns: number;
  flakyTestRuns: number;

  // Test Execution Metrics
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;

  // Timing Metrics
  avgExecutionTime: number;
  p50ExecutionTime: number;
  p95ExecutionTime: number;
  p99ExecutionTime: number;

  // Failure Metrics
  failureRate: number;
  passRate: number;
  flakyTestRate: number;

  // Knowledge Base Metrics
  totalFailuresArchived: number;
  documentedRCAs: number;
  recurringFailures: number;
  rcaCoverageRate: number;

  // Integration Metrics
  jiraIssuesCreated: number;
  mondayItemsCreated: number;
  notificationsSent: number;
}

export interface MetricsTimeRange {
  start: Date;
  end: Date;
}

export interface MetricsByTestSuite {
  suiteName: string;
  metrics: TestMetrics;
}

export interface MetricsByPipeline {
  pipelineId: string;
  pipelineName: string;
  metrics: TestMetrics;
}

export interface TopFailingTest {
  testName: string;
  failureCount: number;
  lastFailure: Date;
}

export interface PrometheusExportOptions {
  includeTimestamp?: boolean;
  timeRange?: MetricsTimeRange;
  aggregationLevel?: 'global' | 'pipeline' | 'suite';
}

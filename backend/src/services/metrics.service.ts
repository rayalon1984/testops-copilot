/**
 * Metrics Service
 *
 * Service for collecting and exporting metrics in Prometheus format
 * Compatible with Grafana, Prometheus, and other monitoring tools
 */

import { PrismaClient } from '@prisma/client';
import {
  TestMetrics,
  MetricsTimeRange,
  MetricsByTestSuite,
  MetricsByPipeline,
  TopFailingTest,
  PrometheusExportOptions,
} from '../types/metrics';

const prisma = new PrismaClient();

export class MetricsService {
  /**
   * Get global test metrics
   */
  static async getGlobalMetrics(timeRange?: MetricsTimeRange): Promise<TestMetrics> {
    const whereClause = timeRange
      ? {
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        }
      : {};

    // Note: These are placeholder queries - adjust based on your actual Prisma schema
    const [
      totalTestRuns,
      passedTestRuns,
      failedTestRuns,
      totalFailuresArchived,
      documentedRCAs,
      recurringFailures,
    ] = await Promise.all([
      // Placeholder counts - replace with actual schema queries
      Promise.resolve(0), // prisma.testRun.count({ where: whereClause }),
      Promise.resolve(0), // prisma.testRun.count({ where: { ...whereClause, status: 'passed' } }),
      Promise.resolve(0), // prisma.testRun.count({ where: { ...whereClause, status: 'failed' } }),
      prisma.failureArchive.count({ where: whereClause }),
      prisma.failureArchive.count({
        where: {
          ...whereClause,
          rootCause: { not: null },
        },
      }),
      prisma.failureArchive.count({
        where: {
          ...whereClause,
          isRecurring: true,
        },
      }),
    ]);

    const totalTests = totalTestRuns;
    const passRate = totalTestRuns > 0 ? (passedTestRuns / totalTestRuns) * 100 : 0;
    const failureRate = totalTestRuns > 0 ? (failedTestRuns / totalTestRuns) * 100 : 0;
    const rcaCoverageRate =
      totalFailuresArchived > 0 ? (documentedRCAs / totalFailuresArchived) * 100 : 0;

    return {
      totalTestRuns,
      passedTestRuns,
      failedTestRuns,
      flakyTestRuns: 0, // Calculate from your schema
      totalTests,
      passedTests: passedTestRuns,
      failedTests: failedTestRuns,
      skippedTests: 0,
      avgExecutionTime: 0, // Calculate from execution times
      p50ExecutionTime: 0,
      p95ExecutionTime: 0,
      p99ExecutionTime: 0,
      failureRate,
      passRate,
      flakyTestRate: 0,
      totalFailuresArchived,
      documentedRCAs,
      recurringFailures,
      rcaCoverageRate,
      jiraIssuesCreated: 0, // Track from integration
      mondayItemsCreated: 0, // Track from integration
      notificationsSent: 0, // Track from notifications
    };
  }

  /**
   * Get top failing tests
   */
  static async getTopFailingTests(limit: number = 10): Promise<TopFailingTest[]> {
    const failures = await prisma.failureArchive.groupBy({
      by: ['testName'],
      _count: {
        testName: true,
      },
      _max: {
        occurredAt: true,
      },
      orderBy: {
        _count: {
          testName: 'desc',
        },
      },
      take: limit,
    });

    return failures.map((failure) => ({
      testName: failure.testName,
      failureCount: failure._count.testName,
      lastFailure: failure._max.occurredAt || new Date(),
    }));
  }

  /**
   * Export metrics in Prometheus text format
   */
  static async exportPrometheusMetrics(
    options: PrometheusExportOptions = {}
  ): Promise<string> {
    const metrics = await this.getGlobalMetrics(options.timeRange);
    const topFailingTests = await this.getTopFailingTests(10);

    const lines: string[] = [];
    const timestamp = options.includeTimestamp ? ` ${Date.now()}` : '';

    // Helper function to format metric
    const addMetric = (
      name: string,
      type: string,
      help: string,
      value: number,
      labels: Record<string, string> = {}
    ) => {
      const labelStr = Object.keys(labels).length
        ? `{${Object.entries(labels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',')}}`
        : '';

      lines.push(`# HELP ${name} ${help}`);
      lines.push(`# TYPE ${name} ${type}`);
      lines.push(`${name}${labelStr} ${value}${timestamp}`);
      lines.push('');
    };

    // Test Run Metrics
    addMetric(
      'testops_test_runs_total',
      'counter',
      'Total number of test runs',
      metrics.totalTestRuns
    );

    addMetric(
      'testops_test_runs_passed',
      'counter',
      'Number of passed test runs',
      metrics.passedTestRuns
    );

    addMetric(
      'testops_test_runs_failed',
      'counter',
      'Number of failed test runs',
      metrics.failedTestRuns
    );

    addMetric(
      'testops_test_runs_flaky',
      'counter',
      'Number of flaky test runs',
      metrics.flakyTestRuns
    );

    // Rate Metrics
    addMetric(
      'testops_pass_rate_percent',
      'gauge',
      'Current pass rate percentage',
      metrics.passRate
    );

    addMetric(
      'testops_failure_rate_percent',
      'gauge',
      'Current failure rate percentage',
      metrics.failureRate
    );

    addMetric(
      'testops_flaky_rate_percent',
      'gauge',
      'Current flaky test rate percentage',
      metrics.flakyTestRate
    );

    // Execution Time Metrics
    addMetric(
      'testops_execution_time_avg_seconds',
      'gauge',
      'Average test execution time in seconds',
      metrics.avgExecutionTime
    );

    addMetric(
      'testops_execution_time_p50_seconds',
      'gauge',
      '50th percentile execution time',
      metrics.p50ExecutionTime
    );

    addMetric(
      'testops_execution_time_p95_seconds',
      'gauge',
      '95th percentile execution time',
      metrics.p95ExecutionTime
    );

    addMetric(
      'testops_execution_time_p99_seconds',
      'gauge',
      '99th percentile execution time',
      metrics.p99ExecutionTime
    );

    // Knowledge Base Metrics
    addMetric(
      'testops_failures_archived_total',
      'counter',
      'Total number of failures in knowledge base',
      metrics.totalFailuresArchived
    );

    addMetric(
      'testops_rcas_documented_total',
      'counter',
      'Number of failures with documented RCA',
      metrics.documentedRCAs
    );

    addMetric(
      'testops_recurring_failures_total',
      'counter',
      'Number of recurring failures',
      metrics.recurringFailures
    );

    addMetric(
      'testops_rca_coverage_percent',
      'gauge',
      'Percentage of failures with documented RCA',
      metrics.rcaCoverageRate
    );

    // Integration Metrics
    addMetric(
      'testops_jira_issues_created_total',
      'counter',
      'Total Jira issues created',
      metrics.jiraIssuesCreated
    );

    addMetric(
      'testops_monday_items_created_total',
      'counter',
      'Total Monday.com items created',
      metrics.mondayItemsCreated
    );

    addMetric(
      'testops_notifications_sent_total',
      'counter',
      'Total notifications sent',
      metrics.notificationsSent
    );

    // Top Failing Tests
    topFailingTests.forEach((test) => {
      addMetric(
        'testops_test_failures_count',
        'gauge',
        'Number of failures per test',
        test.failureCount,
        { test_name: test.testName }
      );
    });

    return lines.join('\n');
  }

  /**
   * Get metrics summary for dashboard
   */
  static async getMetricsSummary(timeRange?: MetricsTimeRange) {
    const [globalMetrics, topFailingTests] = await Promise.all([
      this.getGlobalMetrics(timeRange),
      this.getTopFailingTests(10),
    ]);

    return {
      summary: globalMetrics,
      topFailingTests,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Calculate percentile from array of values
   */
  private static calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }
}

export default MetricsService;

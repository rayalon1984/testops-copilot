/**
 * Confluence Content Formatters
 *
 * Pure functions for building Confluence storage-format HTML content.
 * Extracted from ConfluenceService to keep file sizes under the health baseline.
 */

import { config } from '@/config';

// ── Types ──────────────────────────────────────────────────────────────────

/** Shape of a failure record passed to buildRCAContent */
export interface RCAFailureData {
  testName: string;
  occurredAt?: string | Date;
  lastOccurrence?: string | Date;
  severity: string | null;
  status?: string;
  errorMessage: string;
  stackTrace?: string | null;
  rootCause?: string | null;
  detailedAnalysis?: string | null;
  solution?: string | null;
  preventionSteps?: string | null;
  prevention?: string | null;
  workaround?: string | null;
  environment?: string | null;
  buildNumber?: string | null;
  branch?: string | null;
  commitSha?: string | null;
  isRecurring?: boolean;
  occurrenceCount: number;
  timeToResolve?: number | null;
  jiraIssue?: { issueKey: string; summary: string };
  tags?: string | string[] | null;
  [key: string]: unknown;
}

/** Shape of a test case within a test run */
export interface TestRunCase {
  status: string;
  testName?: string;
  name?: string | null;
  error?: string | null;
  message?: string | null;
  duration?: number | null;
}

/** Shape of a test run passed to buildTestReportContent */
export interface TestRunReportData {
  pipeline: { name: string };
  createdAt: string | Date;
  status: string;
  branch?: string | null;
  commit?: string | null;
  duration?: number | null;
  testResults?: TestRunCase[];
  testCases?: TestRunCase[];
}

// ── Utility functions ──────────────────────────────────────────────────────

export function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    CRITICAL: 'Red',
    HIGH: 'Yellow',
    MEDIUM: 'Blue',
    LOW: 'Grey',
  };
  return colors[severity] || 'Grey';
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PASSED: 'Green',
    SUCCESS: 'Green',
    FAILED: 'Red',
    FAILURE: 'Red',
    RUNNING: 'Blue',
    PENDING: 'Yellow',
    SKIPPED: 'Grey',
  };
  return colors[status] || 'Grey';
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

// ── Content builders ───────────────────────────────────────────────────────

export function buildRCAContent(failure: RCAFailureData, linkToJira: boolean): string {
  let html = `
<h2>Root Cause Analysis</h2>
<p><strong>Test:</strong> ${escapeHtml(failure.testName)}</p>
<p><strong>Occurred At:</strong> ${new Date(failure.occurredAt || failure.lastOccurrence || Date.now()).toLocaleString()}</p>
<p><strong>Severity:</strong> <ac:structured-macro ac:name="status" ac:schema-version="1">
  <ac:parameter ac:name="colour">${getSeverityColor(failure.severity || 'unknown')}</ac:parameter>
  <ac:parameter ac:name="title">${failure.severity}</ac:parameter>
</ac:structured-macro></p>
<p><strong>Status:</strong> ${failure.status}</p>

<h3>Failure Details</h3>
<p><strong>Error Message:</strong></p>
<div class="code panel"><div class="codeContent panelContent"><pre>${escapeHtml(failure.errorMessage)}</pre></div></div>
`;

  if (failure.stackTrace) {
    html += `
<p><strong>Stack Trace:</strong></p>
<ac:structured-macro ac:name="code" ac:schema-version="1">
  <ac:parameter ac:name="language">text</ac:parameter>
  <ac:plain-text-body><![CDATA[${failure.stackTrace}]]></ac:plain-text-body>
</ac:structured-macro>
`;
  }

  html += `
<h3>Root Cause</h3>
<p>${escapeHtml(failure.rootCause || '')}</p>
`;

  if (failure.detailedAnalysis) {
    html += `
<h3>Detailed Analysis</h3>
<p>${escapeHtml(failure.detailedAnalysis)}</p>
`;
  }

  if (failure.solution) {
    html += `
<h3>Solution</h3>
<p>${escapeHtml(failure.solution)}</p>
`;
  }

  if (failure.preventionSteps) {
    html += `
<h3>Prevention Steps</h3>
<p>${escapeHtml(failure.preventionSteps)}</p>
`;
  }

  if (failure.workaround) {
    html += `
<h3>Workaround</h3>
<p>${escapeHtml(failure.workaround)}</p>
`;
  }

  html += `
<h3>Metadata</h3>
<table>
  <tr><th>Field</th><th>Value</th></tr>
  <tr><td>Environment</td><td>${failure.environment || 'N/A'}</td></tr>
  <tr><td>Build Number</td><td>${failure.buildNumber || 'N/A'}</td></tr>
  <tr><td>Branch</td><td>${failure.branch || 'N/A'}</td></tr>
  <tr><td>Commit SHA</td><td>${failure.commitSha || 'N/A'}</td></tr>
  <tr><td>Is Recurring</td><td>${failure.isRecurring ? 'Yes' : 'No'}</td></tr>
  <tr><td>Occurrence Count</td><td>${failure.occurrenceCount}</td></tr>
  ${failure.timeToResolve ? `<tr><td>Time to Resolve</td><td>${failure.timeToResolve} minutes</td></tr>` : ''}
</table>
`;

  if (linkToJira && failure.jiraIssue) {
    html += `
<h3>Related Jira Issue</h3>
<p><a href="${config.jira?.baseUrl}/browse/${failure.jiraIssue.issueKey}">${failure.jiraIssue.issueKey}</a>: ${escapeHtml(failure.jiraIssue.summary)}</p>
`;
  }

  const tagList = Array.isArray(failure.tags) ? failure.tags : [];
  if (tagList.length > 0) {
    html += `
<h3>Tags</h3>
<p>${tagList.map((tag: string) => `<ac:link><ri:page ri:content-title="${tag}"/></ac:link>`).join(', ')}</p>
`;
  }

  return html;
}

export function buildTestReportContent(testRun: TestRunReportData, includeFailureDetails: boolean): string {
  const cases: TestRunCase[] = testRun.testResults || testRun.testCases || [];

  const totalTests = cases.length;
  const passedTests = cases.filter((tc) => tc.status === 'PASSED').length;
  const failedTests = cases.filter((tc) => tc.status === 'FAILED').length;
  const skippedTests = cases.filter((tc) => tc.status === 'SKIPPED').length;
  const passRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(2) : '0';

  let html = `
<h2>Test Execution Summary</h2>
<p><strong>Pipeline:</strong> ${escapeHtml(testRun.pipeline.name)}</p>
<p><strong>Executed At:</strong> ${new Date(testRun.createdAt).toLocaleString()}</p>
<p><strong>Status:</strong> <ac:structured-macro ac:name="status" ac:schema-version="1">
  <ac:parameter ac:name="colour">${getStatusColor(testRun.status)}</ac:parameter>
  <ac:parameter ac:name="title">${testRun.status}</ac:parameter>
</ac:structured-macro></p>
${testRun.branch ? `<p><strong>Branch:</strong> ${escapeHtml(testRun.branch)}</p>` : ''}
${testRun.commit ? `<p><strong>Commit:</strong> <code>${testRun.commit.substring(0, 8)}</code></p>` : ''}
${testRun.duration ? `<p><strong>Duration:</strong> ${formatDuration(testRun.duration)}</p>` : ''}

<h3>Test Results</h3>
<table>
  <tr><th>Metric</th><th>Value</th></tr>
  <tr><td>Total Tests</td><td>${totalTests}</td></tr>
  <tr><td>Passed</td><td><span style="color: green;">${passedTests}</span></td></tr>
  <tr><td>Failed</td><td><span style="color: red;">${failedTests}</span></td></tr>
  <tr><td>Skipped</td><td>${skippedTests}</td></tr>
  <tr><td>Pass Rate</td><td>${passRate}%</td></tr>
</table>
`;

  if (includeFailureDetails && failedTests > 0) {
    html += `
<h3>Failed Tests</h3>
<table>
  <tr><th>Test Name</th><th>Error</th><th>Duration</th></tr>
`;
    cases
      .filter((tc) => tc.status === 'FAILED')
      .forEach((tc) => {
        html += `
  <tr>
    <td>${escapeHtml(tc.testName || tc.name || 'Unknown')}</td>
    <td>${escapeHtml(tc.error || tc.message || 'No error message')}</td>
    <td>${tc.duration ? `${tc.duration}ms` : 'N/A'}</td>
  </tr>
`;
      });
    html += `
</table>
`;
  }

  html += `
<p><em>Generated by TestOps Copilot</em></p>
`;

  return html;
}

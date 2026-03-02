/**
 * Mock Tool Results — Xray Tool Data Shape Tests
 *
 * Validates that mock results for Xray-related tools return the
 * exact data shapes the frontend cards expect. Covers:
 * - xray_search (test_case + test_plan types)
 * - xray_test_case_history
 * - rca_identify (Xray-adjacent — used in analysis flow)
 */

import { getMockToolResult } from '../mock-tool-results';

describe('Mock Xray Tool Results', () => {
  describe('xray_search — test_case type', () => {
    it('returns test cases with key, summary, status', () => {
      const result = getMockToolResult('xray_search', { query: 'checkout', type: 'test_case' });
      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);

      // test_case type wraps results in { testCases: [...] }
      const wrapper = result!.data as Record<string, unknown>;
      const testCases = wrapper.testCases as Array<Record<string, unknown>>;
      expect(Array.isArray(testCases)).toBe(true);
      expect(testCases.length).toBeGreaterThan(0);

      const firstCase = testCases[0];
      expect(firstCase).toHaveProperty('key');
      expect(firstCase).toHaveProperty('summary');
      expect(firstCase).toHaveProperty('status');
    });
  });

  describe('xray_search — test_plan type', () => {
    it('returns test plans with coverage data', () => {
      const result = getMockToolResult('xray_search', { query: 'sprint', type: 'test_plan' });
      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);

      const data = result!.data as Array<Record<string, unknown>>;
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      const firstPlan = data[0];
      expect(firstPlan).toHaveProperty('key');
      expect(firstPlan).toHaveProperty('summary');
      expect(firstPlan).toHaveProperty('testCount');
      expect(firstPlan).toHaveProperty('coveragePercentage');
      expect(typeof firstPlan.coveragePercentage).toBe('number');
    });
  });

  describe('xray_test_case_history', () => {
    it('returns execution history with dates and statuses', () => {
      const result = getMockToolResult('xray_test_case_history', { testCaseKey: 'PROJ-TC-102' });
      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);

      const data = result!.data as Record<string, unknown>;
      expect(data).toHaveProperty('testCaseKey');
      expect(data).toHaveProperty('summary');
      expect(data).toHaveProperty('status');

      const history = data.executionHistory as Array<Record<string, unknown>>;
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);

      const firstExecution = history[0];
      expect(firstExecution).toHaveProperty('date');
      expect(firstExecution).toHaveProperty('status');
      expect(firstExecution).toHaveProperty('executionKey');
    });

    it('includes linked defects array', () => {
      const result = getMockToolResult('xray_test_case_history', { testCaseKey: 'PROJ-TC-102' });
      const data = result!.data as Record<string, unknown>;

      const defects = data.linkedDefects as Array<Record<string, unknown>>;
      expect(Array.isArray(defects)).toBe(true);
      expect(defects.length).toBeGreaterThan(0);

      const firstDefect = defects[0];
      expect(firstDefect).toHaveProperty('key');
      expect(firstDefect).toHaveProperty('summary');
      expect(firstDefect).toHaveProperty('status');
    });

    it('uses provided testCaseKey argument', () => {
      const result = getMockToolResult('xray_test_case_history', { testCaseKey: 'CUSTOM-TC-999' });
      const data = result!.data as Record<string, unknown>;
      expect(data.testCaseKey).toBe('CUSTOM-TC-999');
    });

    it('falls back to default testCaseKey when not provided', () => {
      const result = getMockToolResult('xray_test_case_history', {});
      const data = result!.data as Record<string, unknown>;
      expect(data.testCaseKey).toBe('PROJ-TC-102');
    });
  });

  describe('rca_identify (analysis flow entry point)', () => {
    it('returns all required fields for RootCauseCard', () => {
      const result = getMockToolResult('rca_identify', { testName: 'PaymentProcessor.processCheckout' });
      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);

      const data = result!.data as Record<string, unknown>;
      expect(data).toHaveProperty('title');
      expect(data).toHaveProperty('rootCause');
      expect(data).toHaveProperty('confidence');
      expect(data).toHaveProperty('category');
      expect(data).toHaveProperty('relatedIssue');
      expect(data).toHaveProperty('testName');
    });

    it('echoes testName from arguments', () => {
      const result = getMockToolResult('rca_identify', { testName: 'MyCustomTest.run' });
      const data = result!.data as Record<string, unknown>;
      expect(data.testName).toBe('MyCustomTest.run');
    });

    it('confidence is between 0 and 1', () => {
      const result = getMockToolResult('rca_identify', {});
      const data = result!.data as Record<string, unknown>;
      expect(data.confidence).toBeGreaterThan(0);
      expect(data.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('unknown tool fallback', () => {
    it('returns null for unregistered tool names', () => {
      const result = getMockToolResult('nonexistent_tool', {});
      expect(result).toBeNull();
    });
  });
});

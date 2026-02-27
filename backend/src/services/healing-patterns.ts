/**
 * Healing Patterns — Built-in transient failure detection patterns.
 *
 * Extracted from self-healing.service.ts for modularity and the
 * 600-line file-length CI gate.
 */

import type { BuiltInPattern } from '../types/healing';

// ─── Built-in transient failure patterns ────────────────

export const BUILT_IN_PATTERNS: BuiltInPattern[] = [
  {
    name: 'Network Timeout',
    description: 'Transient network connectivity failures (ETIMEDOUT, ECONNRESET, socket hang up)',
    pattern: '(ETIMEDOUT|ECONNRESET|ECONNREFUSED|socket hang up|network timeout|connection timed out)',
    patternType: 'regex',
    category: 'transient',
    action: 'retry',
    confidenceThreshold: 0.9,
    priority: 10,
  },
  {
    name: 'Docker Rate Limit',
    description: 'Docker Hub pull rate limiting (429 Too Many Requests)',
    pattern: '(too many requests|rate limit.*docker|docker\\.io.*429|pull rate limit)',
    patternType: 'regex',
    category: 'infrastructure',
    action: 'retry',
    confidenceThreshold: 0.95,
    priority: 20,
  },
  {
    name: 'npm Registry Error',
    description: 'npm registry transient failures (503, fetch errors)',
    pattern: '(npm ERR!.*50[0-9]|FETCH_ERROR|registry\\.npmjs\\.org.*error|ERESOLVE)',
    patternType: 'regex',
    category: 'transient',
    action: 'retry',
    confidenceThreshold: 0.9,
    priority: 15,
  },
  {
    name: 'Selenium Stale Element',
    description: 'Browser automation stale element or detached DOM errors',
    pattern: '(StaleElementReferenceException|element is not attached|element click intercepted|no such element)',
    patternType: 'regex',
    category: 'flaky',
    action: 'retry',
    confidenceThreshold: 0.85,
    priority: 30,
  },
  {
    name: 'DNS Resolution Failure',
    description: 'Transient DNS lookup failures',
    pattern: '(ENOTFOUND|getaddrinfo.*failed|DNS.*timeout|name resolution)',
    patternType: 'regex',
    category: 'transient',
    action: 'retry',
    confidenceThreshold: 0.9,
    priority: 10,
  },
  {
    name: 'Out of Memory',
    description: 'Process killed due to memory pressure',
    pattern: '(JavaScript heap out of memory|ENOMEM|OOMKilled|allocation failed)',
    patternType: 'regex',
    category: 'infrastructure',
    action: 'notify',
    confidenceThreshold: 0.95,
    priority: 5,
  },
  {
    name: 'Disk Space Exhausted',
    description: 'No disk space left on device',
    pattern: '(ENOSPC|No space left on device|disk space|disk quota exceeded)',
    patternType: 'regex',
    category: 'infrastructure',
    action: 'notify',
    confidenceThreshold: 0.95,
    priority: 5,
  },
  {
    name: 'Flaky Assertion Timeout',
    description: 'Test timeout waiting for async condition',
    pattern: '(Timeout.*waiting|exceeded timeout|waitFor.*timed out|async callback.*not.*invoked)',
    patternType: 'regex',
    category: 'flaky',
    action: 'retry',
    confidenceThreshold: 0.8,
    priority: 40,
  },
];

// ─── Circuit-breaker constants ──────────────────────────

export const MAX_RETRIES_PER_PIPELINE_PER_HOUR = 2;

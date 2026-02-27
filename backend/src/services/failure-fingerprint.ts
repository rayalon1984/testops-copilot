/**
 * Failure Fingerprinting Utilities
 *
 * Pure functions for generating failure signatures and calculating similarity
 * between error messages. Extracted from FailureArchiveService to keep the
 * service focused on CRUD/lifecycle operations.
 */

import crypto from 'crypto';

/**
 * Normalize error messages by removing variable parts (timestamps, UUIDs, IDs, etc.)
 */
export function normalizeErrorMessage(error: string): string {
  return error
    .toLowerCase()
    // Remove timestamps
    .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, 'TIMESTAMP')
    // Remove UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID')
    // Remove IDs
    .replace(/id[=:\s]+[\w-]+/gi, 'id=ID')
    // Remove line numbers
    .replace(/line \d+/gi, 'line X')
    .replace(/:\d+:\d+/g, ':X:X')
    // Remove memory addresses
    .replace(/0x[0-9a-f]+/gi, '0xADDR')
    // Trim and collapse whitespace
    .trim()
    .replace(/\s+/g, ' ')
    .substring(0, 100); // Take first 100 chars for signature
}

/**
 * Normalize stack traces for comparison (top 5 frames, no line numbers)
 */
export function normalizeStackTrace(stackTrace: string): string {
  return stackTrace
    .split('\n')
    .slice(0, 5) // Only look at top 5 stack frames
    .map(line =>
      line
        .replace(/:\d+:\d+/g, ':X:X')
        .replace(/\([^)]+\)/g, '()')
        .trim()
    )
    .join('\n');
}

/**
 * Generate a unique signature for failure pattern matching.
 * Combines hashed test name, normalized error, and (optionally) stack trace.
 */
export function generateFailureSignature(
  testName: string,
  errorMessage: string,
  stackTrace?: string
): string {
  const normalizedError = normalizeErrorMessage(errorMessage);
  const stackHash = stackTrace
    ? crypto.createHash('md5').update(normalizeStackTrace(stackTrace)).digest('hex').substring(0, 8)
    : 'nostk';
  const testHash = crypto.createHash('md5').update(testName).digest('hex').substring(0, 8);

  return `${testHash}:${normalizedError}:${stackHash}`;
}

/**
 * Levenshtein distance algorithm
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate string similarity (0–1) using Levenshtein distance
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

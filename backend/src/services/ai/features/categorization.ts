/**
 * AI Features - Automated Failure Categorization
 *
 * Uses AI to automatically categorize test failures into:
 * - bug_critical: Critical bugs blocking functionality
 * - bug_minor: Minor bugs with workarounds
 * - environment: Environment/infrastructure issues
 * - flaky: Flaky/intermittent test issues
 * - configuration: Configuration or setup issues
 * - unknown: Unable to determine category
 */

import { BaseProvider } from '../providers/base.provider';
import { TestFailure, FailureCategory, FailureCategorization, ChatMessage } from '../types';

export interface CategorizationOptions {
  /**
   * Include historical context if available
   */
  includeHistory?: boolean;

  /**
   * Minimum confidence threshold (0-1)
   * Default: 0.7
   */
  minConfidence?: number;

  /**
   * Use faster/cheaper model for categorization
   */
  useFastModel?: boolean;
}

export class CategorizationService {
  private provider: BaseProvider;

  constructor(provider: BaseProvider) {
    this.provider = provider;
  }

  /**
   * Categorize a test failure using AI
   *
   * Analyzes the error message, stack trace, and logs to determine
   * the most likely category and confidence level.
   */
  async categorizeFailure(
    failure: TestFailure,
    options: CategorizationOptions = {}
  ): Promise<FailureCategorization> {
    const prompt = this.buildCategorizationPrompt(failure);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: this.getSystemPrompt(),
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    try {
      const response = await this.provider.chat(messages, {
        maxTokens: 500,
        temperature: 0.2, // Lower temperature for consistent categorization
      });

      return this.parseCategorizationResponse(response.content);
    } catch (error) {
      console.error('Categorization failed:', error);
      return {
        category: 'unknown',
        confidence: 0,
        reasoning: 'Failed to categorize due to error',
        suggestedAction: 'Manual review required',
      };
    }
  }

  /**
   * Batch categorize multiple failures
   */
  async categorizeFailures(
    failures: TestFailure[],
    options: CategorizationOptions = {}
  ): Promise<FailureCategorization[]> {
    const results = await Promise.allSettled(
      failures.map(failure => this.categorizeFailure(failure, options))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          category: 'unknown' as FailureCategory,
          confidence: 0,
          reasoning: `Categorization failed: ${result.reason}`,
          suggestedAction: 'Manual review required',
        };
      }
    });
  }

  /**
   * Get system prompt for categorization
   */
  private getSystemPrompt(): string {
    return `You are an expert QA engineer specialized in analyzing test failures.

Your task is to categorize test failures into one of these categories:

1. **bug_critical**: Critical bugs that block main functionality or cause crashes
   - Examples: NullPointerException, application crashes, data corruption, security vulnerabilities

2. **bug_minor**: Minor bugs with workarounds or low impact
   - Examples: UI glitches, minor calculation errors, cosmetic issues

3. **environment**: Environment or infrastructure issues
   - Examples: Network timeouts, database connection failures, missing dependencies, resource exhaustion

4. **flaky**: Flaky or intermittent test issues
   - Examples: Timing issues, race conditions, inconsistent test data, non-deterministic behavior

5. **configuration**: Configuration or setup issues
   - Examples: Wrong environment variables, missing config files, incorrect permissions

6. **unknown**: Unable to determine with confidence

Respond ONLY in this exact JSON format:
{
  "category": "bug_critical|bug_minor|environment|flaky|configuration|unknown",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation (1-2 sentences)",
  "suggestedAction": "Specific next step to take",
  "relatedIssues": ["optional array of related issue patterns"]
}`;
  }

  /**
   * Build categorization prompt from failure data
   */
  private buildCategorizationPrompt(failure: TestFailure): string {
    let prompt = '# Test Failure Analysis\n\n';

    prompt += `**Test Name**: ${failure.testName}\n`;
    prompt += `**Pipeline**: ${failure.pipeline}\n`;
    prompt += `**Branch**: ${failure.branch}\n\n`;

    prompt += `## Error Message\n\`\`\`\n${failure.errorMessage}\n\`\`\`\n\n`;

    if (failure.stackTrace) {
      const truncatedStack = failure.stackTrace.split('\n').slice(0, 15).join('\n');
      prompt += `## Stack Trace\n\`\`\`\n${truncatedStack}\n\`\`\`\n\n`;
    }

    if (failure.logSnippet) {
      const truncatedLog = failure.logSnippet.substring(0, 1000);
      prompt += `## Log Snippet\n\`\`\`\n${truncatedLog}\n\`\`\`\n\n`;
    }

    if (failure.category && failure.categoryConfidence) {
      prompt += `## Previous Categorization\n`;
      prompt += `Category: ${failure.category}\n`;
      prompt += `Confidence: ${(failure.categoryConfidence * 100).toFixed(1)}%\n\n`;
    }

    prompt += 'Analyze this failure and provide categorization in JSON format.';

    return prompt;
  }

  /**
   * Parse AI response into FailureCategorization
   */
  private parseCategorizationResponse(content: string): FailureCategorization {
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and map response
      const category = this.validateCategory(parsed.category);
      const confidence = Math.max(0, Math.min(1, parseFloat(parsed.confidence) || 0));

      return {
        category,
        confidence,
        reasoning: parsed.reasoning || 'No reasoning provided',
        suggestedAction: parsed.suggestedAction || 'Review failure details',
        relatedIssues: Array.isArray(parsed.relatedIssues) ? parsed.relatedIssues : undefined,
      };
    } catch (error) {
      console.error('Failed to parse categorization response:', error);
      console.error('Response content:', content);

      // Try to extract category from text if JSON parsing fails
      const categoryMatch = content.match(/category["\s:]+([a-z_]+)/i);
      if (categoryMatch) {
        const category = this.validateCategory(categoryMatch[1]);
        return {
          category,
          confidence: 0.5,
          reasoning: 'Extracted from text response',
          suggestedAction: 'Review and verify categorization',
        };
      }

      return {
        category: 'unknown',
        confidence: 0,
        reasoning: 'Failed to parse AI response',
        suggestedAction: 'Manual categorization required',
      };
    }
  }

  /**
   * Validate and normalize category
   */
  private validateCategory(category: string): FailureCategory {
    const normalized = category.toLowerCase().trim();
    const validCategories: FailureCategory[] = [
      'bug_critical',
      'bug_minor',
      'environment',
      'flaky',
      'configuration',
      'unknown',
    ];

    if (validCategories.includes(normalized as FailureCategory)) {
      return normalized as FailureCategory;
    }

    // Try to map common variations
    if (normalized.includes('bug')) {
      if (normalized.includes('critical') || normalized.includes('high') || normalized.includes('severe')) {
        return 'bug_critical';
      }
      return 'bug_minor';
    }

    if (normalized.includes('flaky') || normalized.includes('intermittent')) {
      return 'flaky';
    }

    if (normalized.includes('environment') || normalized.includes('infrastructure')) {
      return 'environment';
    }

    if (normalized.includes('config')) {
      return 'configuration';
    }

    return 'unknown';
  }

  /**
   * Get statistics about categorizations
   */
  async getCategorizationStats(failures: TestFailure[]): Promise<{
    total: number;
    byCategory: Record<FailureCategory, number>;
    avgConfidence: number;
  }> {
    const stats: Record<FailureCategory, number> = {
      bug_critical: 0,
      bug_minor: 0,
      environment: 0,
      flaky: 0,
      configuration: 0,
      unknown: 0,
    };

    let totalConfidence = 0;
    let categorizedCount = 0;

    for (const failure of failures) {
      if (failure.category) {
        stats[failure.category]++;
        if (failure.categoryConfidence) {
          totalConfidence += failure.categoryConfidence;
          categorizedCount++;
        }
      }
    }

    return {
      total: failures.length,
      byCategory: stats,
      avgConfidence: categorizedCount > 0 ? totalConfidence / categorizedCount : 0,
    };
  }
}

/**
 * AI Features - Log Summarization
 *
 * Uses AI to summarize lengthy test logs, extracting:
 * - Key error information
 * - Root cause analysis
 * - Error location (file, line)
 * - Relevant log lines
 * - Suggested fixes
 */

import { BaseProvider } from '../providers/base.provider';
import { LogSummary, ChatMessage } from '../types';
import * as crypto from 'crypto';

export interface SummarizationOptions {
  /**
   * Maximum log length to process (chars)
   * Default: 50000
   */
  maxLogLength?: number;

  /**
   * Include code snippets in summary
   * Default: true
   */
  includeCodeSnippets?: boolean;

  /**
   * Prioritize most recent logs
   * Default: true
   */
  prioritizeRecent?: boolean;
}

export class LogSummarizationService {
  private provider: BaseProvider;

  constructor(provider: BaseProvider) {
    this.provider = provider;
  }

  /**
   * Summarize test failure logs using AI
   *
   * Takes lengthy logs and extracts the most important information
   * including root cause, error location, and suggested fixes.
   */
  async summarizeLogs(
    logs: string,
    testName: string,
    errorMessage: string,
    options: SummarizationOptions = {}
  ): Promise<LogSummary> {
    const maxLength = options.maxLogLength || 50000;
    const processedLogs = this.preprocessLogs(logs, maxLength, options.prioritizeRecent ?? true);

    const prompt = this.buildSummarizationPrompt(processedLogs, testName, errorMessage);

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
        maxTokens: 1000,
        temperature: 0.3,
      });

      return this.parseSummaryResponse(response.content);
    } catch (error) {
      console.error('Log summarization failed:', error);
      return {
        summary: 'Failed to generate summary',
        rootCause: 'Unable to determine',
        keyLogLines: [],
        suggestedFix: 'Manual investigation required',
        confidence: 0,
      };
    }
  }

  /**
   * Generate hash for log content (for caching)
   */
  generateLogHash(logs: string): string {
    return crypto.createHash('sha256').update(logs).digest('hex');
  }

  /**
   * Get system prompt for log summarization
   */
  private getSystemPrompt(): string {
    return `You are an expert DevOps engineer specialized in analyzing test failure logs.

Your task is to:
1. Identify the root cause of the test failure
2. Extract the most relevant log lines
3. Locate the error in the codebase (file and line number)
4. Suggest specific fixes

Respond ONLY in this exact JSON format:
{
  "summary": "Brief 2-3 sentence summary of what went wrong",
  "rootCause": "Specific root cause (be precise)",
  "errorLocation": {
    "file": "path/to/file.ext",
    "line": 123,
    "snippet": "relevant code snippet if available"
  },
  "keyLogLines": [
    {
      "lineNumber": 1,
      "content": "log line content",
      "relevance": "high|medium|low"
    }
  ],
  "suggestedFix": "Specific actionable fix (1-2 sentences)",
  "confidence": 0.0-1.0
}

Focus on actionable insights. Be concise but precise.`;
  }

  /**
   * Preprocess logs for analysis
   */
  private preprocessLogs(
    logs: string,
    maxLength: number,
    prioritizeRecent: boolean
  ): string {
    if (logs.length <= maxLength) {
      return logs;
    }

    const lines = logs.split('\n');

    if (prioritizeRecent) {
      // Take most recent logs + any error/exception lines from earlier
      const recentLines = lines.slice(-Math.floor(maxLength / 100));
      const errorLines = lines
        .slice(0, -recentLines.length)
        .filter(line =>
          line.toLowerCase().includes('error') ||
          line.toLowerCase().includes('exception') ||
          line.toLowerCase().includes('failed') ||
          line.toLowerCase().includes('fatal')
        );

      const combined = [...errorLines, ...recentLines];
      return combined.join('\n').substring(0, maxLength);
    }

    // Just truncate from the end
    return logs.substring(logs.length - maxLength);
  }

  /**
   * Build summarization prompt
   */
  private buildSummarizationPrompt(
    logs: string,
    testName: string,
    errorMessage: string
  ): string {
    let prompt = '# Test Failure Log Analysis\n\n';

    prompt += `**Test Name**: ${testName}\n`;
    prompt += `**Error Message**: ${errorMessage}\n\n`;

    prompt += '## Full Logs\n```\n';
    prompt += logs;
    prompt += '\n```\n\n';

    prompt += 'Analyze these logs and provide a comprehensive summary in JSON format.';

    return prompt;
  }

  /**
   * Parse AI response into LogSummary
   */
  private parseSummaryResponse(content: string): LogSummary {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const summary: LogSummary = {
        summary: parsed.summary || 'No summary provided',
        rootCause: parsed.rootCause || 'Unable to determine',
        keyLogLines: [],
        suggestedFix: parsed.suggestedFix || 'Manual investigation required',
        confidence: Math.max(0, Math.min(1, parseFloat(parsed.confidence) || 0)),
      };

      // Parse error location if available
      if (parsed.errorLocation) {
        summary.errorLocation = {
          file: parsed.errorLocation.file || 'unknown',
          line: parseInt(parsed.errorLocation.line, 10) || 0,
          snippet: parsed.errorLocation.snippet,
        };
      }

      // Parse key log lines
      if (Array.isArray(parsed.keyLogLines)) {
        summary.keyLogLines = parsed.keyLogLines
          .slice(0, 10) // Limit to 10 lines
          .map((line: any) => ({
            lineNumber: parseInt(line.lineNumber, 10) || 0,
            content: line.content || '',
            relevance: this.validateRelevance(line.relevance),
          }));
      }

      return summary;
    } catch (error) {
      console.error('Failed to parse summary response:', error);
      console.error('Response content:', content);

      // Try to extract basic info from text
      return {
        summary: content.substring(0, 200),
        rootCause: 'Unable to parse AI response',
        keyLogLines: [],
        suggestedFix: 'Manual investigation required',
        confidence: 0.3,
      };
    }
  }

  /**
   * Validate relevance level
   */
  private validateRelevance(relevance: string): 'high' | 'medium' | 'low' {
    const normalized = relevance?.toLowerCase().trim();
    if (normalized === 'high' || normalized === 'medium' || normalized === 'low') {
      return normalized as 'high' | 'medium' | 'low';
    }
    return 'medium';
  }

  /**
   * Batch summarize multiple logs
   */
  async summarizeMultiple(
    items: Array<{
      logs: string;
      testName: string;
      errorMessage: string;
    }>,
    options: SummarizationOptions = {}
  ): Promise<LogSummary[]> {
    const results = await Promise.allSettled(
      items.map(item =>
        this.summarizeLogs(item.logs, item.testName, item.errorMessage, options)
      )
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          summary: `Failed to summarize: ${result.reason}`,
          rootCause: 'Summarization failed',
          keyLogLines: [],
          suggestedFix: 'Manual review required',
          confidence: 0,
        };
      }
    });
  }

  /**
   * Compare two summaries for similarity
   */
  compareSummaries(summary1: LogSummary, summary2: LogSummary): number {
    // Simple text similarity based on common words
    const words1 = new Set(
      summary1.rootCause.toLowerCase().split(/\W+/).filter(w => w.length > 3)
    );
    const words2 = new Set(
      summary2.rootCause.toLowerCase().split(/\W+/).filter(w => w.length > 3)
    );

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }
}

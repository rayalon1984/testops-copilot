/**
 * Selection Explainer Service
 *
 * Generates human-readable, natural-language explanations of why specific
 * tests were selected (or not selected) by the Smart Test Selection system.
 *
 * Uses AIManager when available for rich AI-powered explanations.
 * Falls back to rule-based template explanations when AI is unavailable.
 *
 * This bridges the gap between automated selection decisions and developer
 * understanding — essential for trust and adoption.
 */

import { logger } from '@/utils/logger';
import { getAIManager } from '@/services/ai/manager';
import { ChatMessage } from '@/services/ai/types';
import { TestSelectionResult, SelectionDetail } from './TestImpactService';

// ── Types ────────────────────────────────────────────────────────────────

export interface ExplanationInput {
  /** The selection result from TestImpactService */
  selectionResult: TestSelectionResult;
  /** Changed files that triggered the selection */
  changedFiles: string[];
  /** Optional: PR title for context */
  prTitle?: string;
  /** Optional: PR number */
  prNumber?: number;
  /** Optional: branch name */
  branch?: string;
}

export interface SelectionExplanation {
  /** Full narrative explanation */
  summary: string;
  /** Per-file explanations */
  fileExplanations: FileExplanation[];
  /** Strategy breakdown */
  strategyBreakdown: StrategyBreakdown[];
  /** Confidence assessment */
  confidenceNote: string;
  /** Actionable recommendations */
  recommendations: string[];
  /** Whether AI was used (true) or rule-based fallback (false) */
  aiPowered: boolean;
}

export interface FileExplanation {
  file: string;
  mappedTests: string[];
  strategy: string;
  explanation: string;
}

export interface StrategyBreakdown {
  strategy: string;
  testCount: number;
  description: string;
  confidence: number;
}

// ── Strategy descriptions ────────────────────────────────────────────────

const STRATEGY_DESCRIPTIONS: Record<string, string> = {
  direct: 'The test file itself was modified — it must be re-run to verify correctness.',
  convention: 'Mapped via naming convention (source file → co-located test file).',
  dependency: 'Identified through import dependency analysis — this test imports the changed module (directly or transitively).',
  coverage: 'Previous code coverage data shows this test exercises the changed code lines.',
  global: 'A global configuration file changed — all tests must run as a safety measure.',
  directory: 'Located in the same directory as the changed source file.',
  correlation: 'Historical analysis shows this test frequently fails when these files change.',
};

const CONFIDENCE_THRESHOLDS = {
  high: { min: 0.85, label: 'High', note: 'The selection is highly reliable — based on precise mapping (coverage data, direct test changes, or dependency graph).' },
  medium: { min: 0.65, label: 'Medium', note: 'The selection is reasonably reliable — based on convention mapping or dependency analysis. Consider running the full suite for critical releases.' },
  low: { min: 0, label: 'Low', note: 'The selection has limited confidence — based on naming conventions only. Recommended to run the full test suite to be safe.' },
};

// ── Service ──────────────────────────────────────────────────────────────

export class SelectionExplainerService {

  /**
   * Generate a comprehensive explanation for a test selection decision.
   *
   * Tries AI-powered explanation first, falls back to rule-based templates.
   */
  async explain(input: ExplanationInput): Promise<SelectionExplanation> {
    const { selectionResult } = input;

    // Build per-file explanations (always rule-based — deterministic)
    const fileExplanations = this.buildFileExplanations(selectionResult.details);

    // Build strategy breakdown
    const strategyBreakdown = this.buildStrategyBreakdown(selectionResult.details);

    // Confidence note
    const confidenceNote = this.getConfidenceNote(selectionResult.confidence);

    // Try AI-powered summary, fall back to rule-based
    let summary: string;
    let recommendations: string[];
    let aiPowered = false;

    try {
      const aiResult = await this.generateAISummary(input, fileExplanations, strategyBreakdown);
      if (aiResult) {
        summary = aiResult.summary;
        recommendations = aiResult.recommendations;
        aiPowered = true;
      } else {
        const ruleResult = this.generateRuleBasedSummary(input, fileExplanations, strategyBreakdown);
        summary = ruleResult.summary;
        recommendations = ruleResult.recommendations;
      }
    } catch (error) {
      logger.warn('[SelectionExplainer] AI explanation failed, using rule-based fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
      const ruleResult = this.generateRuleBasedSummary(input, fileExplanations, strategyBreakdown);
      summary = ruleResult.summary;
      recommendations = ruleResult.recommendations;
    }

    return {
      summary,
      fileExplanations,
      strategyBreakdown,
      confidenceNote,
      recommendations,
      aiPowered,
    };
  }

  // ── AI-Powered Explanation ─────────────────────────────────────────────

  /**
   * Generate an AI-powered explanation using AIManager.
   * Returns null if AI is unavailable.
   */
  private async generateAISummary(
    input: ExplanationInput,
    fileExplanations: FileExplanation[],
    strategyBreakdown: StrategyBreakdown[]
  ): Promise<{ summary: string; recommendations: string[] } | null> {
    let aiManager;
    try {
      aiManager = getAIManager();
    } catch {
      return null; // AI Manager not initialized
    }

    if (!aiManager.isInitialized() || !aiManager.isEnabled()) {
      return null;
    }

    const provider = aiManager.getProvider();
    if (!provider) return null;

    const systemPrompt = `You are a senior CI/CD engineer explaining test selection decisions to developers. Your explanations should be:
- Clear and concise (2-4 sentences for the summary)
- Actionable (include specific recommendations)
- Confidence-aware (mention when selection might be imprecise)
- Developer-friendly (no jargon, explain the "why")

Respond in JSON format:
{
  "summary": "string — 2-4 sentence explanation of why these tests were selected",
  "recommendations": ["string — actionable recommendation", ...]
}`;

    const userPrompt = this.buildAIPrompt(input, fileExplanations, strategyBreakdown);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    try {
      const response = await provider.chat(messages, {
        maxTokens: 800,
        temperature: 0.3,
      });

      // Parse JSON response
      const parsed = JSON.parse(response.content);
      return {
        summary: parsed.summary || this.generateRuleBasedSummary(input, fileExplanations, strategyBreakdown).summary,
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      };
    } catch (error) {
      logger.warn('[SelectionExplainer] Failed to parse AI response', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Build the prompt for AI explanation.
   */
  private buildAIPrompt(
    input: ExplanationInput,
    fileExplanations: FileExplanation[],
    strategyBreakdown: StrategyBreakdown[]
  ): string {
    const { selectionResult, changedFiles, prTitle, prNumber, branch } = input;

    let prompt = `## Test Selection Decision\n\n`;

    if (prTitle && prNumber) {
      prompt += `**PR #${prNumber}:** ${prTitle}\n`;
    }
    if (branch) {
      prompt += `**Branch:** ${branch}\n`;
    }

    prompt += `**Changed Files (${changedFiles.length}):** ${changedFiles.slice(0, 10).join(', ')}`;
    if (changedFiles.length > 10) {
      prompt += ` (and ${changedFiles.length - 10} more)`;
    }
    prompt += '\n\n';

    prompt += `**Selection Result:**\n`;
    prompt += `- Tests selected: ${selectionResult.selectedTests.length}\n`;
    prompt += `- Total tests in suite: ${selectionResult.totalTests}\n`;
    prompt += `- Tests saved: ${selectionResult.savedTests}\n`;
    prompt += `- Confidence: ${Math.round(selectionResult.confidence * 100)}%\n`;
    prompt += `- Primary strategy: ${selectionResult.selectionStrategy}\n\n`;

    prompt += `**Strategy Breakdown:**\n`;
    for (const sb of strategyBreakdown) {
      prompt += `- ${sb.strategy}: ${sb.testCount} tests (${sb.description})\n`;
    }

    prompt += `\n**File-to-Test Mappings (first 10):**\n`;
    for (const fe of fileExplanations.slice(0, 10)) {
      prompt += `- ${fe.file} → ${fe.mappedTests.length} test(s) via ${fe.strategy}\n`;
    }

    prompt += `\nExplain this selection decision and provide recommendations.`;

    return prompt;
  }

  // ── Rule-Based Explanation ─────────────────────────────────────────────

  /**
   * Generate a rule-based explanation (no AI required).
   */
  private generateRuleBasedSummary(
    input: ExplanationInput,
    _fileExplanations: FileExplanation[],
    strategyBreakdown: StrategyBreakdown[]
  ): { summary: string; recommendations: string[] } {
    const { selectionResult, changedFiles } = input;
    const recommendations: string[] = [];

    // Build summary
    let summary: string;

    if (selectionResult.selectedTests.includes('ALL')) {
      summary = `All tests will run because a global configuration file was modified (${selectionResult.reason}). ` +
        `Changes to configuration files like schema.prisma, package.json, or tsconfig.json can affect any part of the codebase, ` +
        `so running the full suite ensures nothing is missed.`;
    } else if (selectionResult.selectedTests.length === 0) {
      summary = `No tests were selected because the ${changedFiles.length} changed file(s) ` +
        `don't appear to have associated test files. This could mean the changes are in ` +
        `documentation, configuration, or non-source code files.`;
      recommendations.push('Review the changed files to ensure they don\'t require test coverage.');
    } else {
      const strategies = strategyBreakdown.map(s => `${s.strategy} (${s.testCount})`).join(', ');
      const savingsPercent = selectionResult.totalTests > 0
        ? Math.round((selectionResult.savedTests / selectionResult.totalTests) * 100)
        : 0;

      summary = `${selectionResult.selectedTests.length} test(s) selected from ${changedFiles.length} changed file(s), ` +
        `saving ${selectionResult.savedTests} tests (~${savingsPercent}% reduction). ` +
        `Selection strategies used: ${strategies}. ` +
        `Confidence: ${Math.round(selectionResult.confidence * 100)}%.`;
    }

    // Generate recommendations based on strategy and confidence
    if (selectionResult.confidence < 0.7 && selectionResult.selectedTests.length > 0) {
      recommendations.push(
        'Consider running the full test suite — selection confidence is below 70%. ' +
        'This typically happens when only convention-based mapping is available.'
      );
    }

    if (selectionResult.confidence >= 0.85) {
      recommendations.push(
        'High confidence selection — safe to run only selected tests for this PR.'
      );
    }

    if (strategyBreakdown.some(s => s.strategy === 'convention')) {
      recommendations.push(
        'Some tests were selected via naming convention only. ' +
        'Upload coverage data to improve precision with coverage-based selection.'
      );
    }

    if (selectionResult.selectedTests.length > 50) {
      recommendations.push(
        `${selectionResult.selectedTests.length} tests is a large selection. ` +
        'Consider splitting the PR into smaller, focused changesets for faster CI.'
      );
    }

    return { summary, recommendations };
  }

  // ── Helper Methods ─────────────────────────────────────────────────────

  /**
   * Build per-file explanations from selection details.
   */
  private buildFileExplanations(details: SelectionDetail[]): FileExplanation[] {
    return details.map(detail => ({
      file: detail.changedFile,
      mappedTests: detail.mappedTests,
      strategy: detail.strategy,
      explanation: STRATEGY_DESCRIPTIONS[detail.strategy] ?? 'Unknown selection strategy.',
    }));
  }

  /**
   * Build strategy breakdown from selection details.
   */
  private buildStrategyBreakdown(details: SelectionDetail[]): StrategyBreakdown[] {
    const strategyMap = new Map<string, { tests: Set<string>; confidence: number }>();

    const confidenceWeights: Record<string, number> = {
      direct: 1.0,
      global: 1.0,
      coverage: 0.95,
      dependency: 0.85,
      correlation: 0.8,
      convention: 0.7,
      directory: 0.6,
    };

    for (const detail of details) {
      if (!strategyMap.has(detail.strategy)) {
        strategyMap.set(detail.strategy, {
          tests: new Set(),
          confidence: confidenceWeights[detail.strategy] ?? 0.5,
        });
      }
      const entry = strategyMap.get(detail.strategy)!;
      for (const test of detail.mappedTests) {
        entry.tests.add(test);
      }
    }

    return Array.from(strategyMap.entries()).map(([strategy, data]) => ({
      strategy,
      testCount: data.tests.size,
      description: STRATEGY_DESCRIPTIONS[strategy] ?? 'Unknown strategy',
      confidence: data.confidence,
    }));
  }

  /**
   * Get a confidence note based on the confidence score.
   */
  private getConfidenceNote(confidence: number): string {
    if (confidence >= CONFIDENCE_THRESHOLDS.high.min) {
      return `${CONFIDENCE_THRESHOLDS.high.label} (${Math.round(confidence * 100)}%): ${CONFIDENCE_THRESHOLDS.high.note}`;
    }
    if (confidence >= CONFIDENCE_THRESHOLDS.medium.min) {
      return `${CONFIDENCE_THRESHOLDS.medium.label} (${Math.round(confidence * 100)}%): ${CONFIDENCE_THRESHOLDS.medium.note}`;
    }
    return `${CONFIDENCE_THRESHOLDS.low.label} (${Math.round(confidence * 100)}%): ${CONFIDENCE_THRESHOLDS.low.note}`;
  }
}

export const selectionExplainerService = new SelectionExplainerService();

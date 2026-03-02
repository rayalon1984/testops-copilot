/**
 * Context Enrichment Service
 *
 * Orchestrates cross-platform context gathering for test failures.
 * Pulls data from Jira, Confluence, GitHub, and the internal failure archive,
 * then uses AI to synthesize actionable insights.
 *
 * This is the "knowledge layer" that makes TestOps Copilot code-aware
 * and project-aware — not just a test log analyzer.
 */

import { logger } from '@/utils/logger';
import { jiraService } from '@/services/jira.service';
import { confluenceService } from '@/services/confluence.service';
import { githubService } from '@/services/github.service';
import { xrayService } from '@/services/xray.service';
import { JiraIssueResponse } from '@/types/jira';
import { TestFailure, ChatMessage } from '../types';
import { BaseProvider } from '../providers/base.provider';
import type {
  EnrichmentInput,
  EnrichmentResult,
  CodeChange,
  PullRequestContext,
  JiraContext,
  ConfluenceContext,
  XrayEnrichmentContext,
} from './context-enrichment.types';

// Re-export types so existing imports from this file continue to work
export type {
  EnrichmentInput,
  EnrichmentResult,
  CodeChange,
  PullRequestContext,
  JiraContext,
  ConfluenceContext,
  XrayEnrichmentContext,
} from './context-enrichment.types';

// ── Service ────────────────────────────────────────────────────────────────

export class ContextEnrichmentService {
  private provider: BaseProvider | null = null;

  constructor(provider?: BaseProvider) {
    this.provider = provider || null;
  }

  setProvider(provider: BaseProvider): void {
    this.provider = provider;
  }

  /**
   * Enrich a test failure with context from Jira, Confluence, and GitHub.
   * Returns gathered context and an AI-synthesized analysis.
   */
  async enrichFailureContext(input: EnrichmentInput): Promise<EnrichmentResult> {
    const { failure, sources, maxResultsPerSource = 5 } = input;
    const enableJira = sources?.jira !== false;
    const enableConfluence = sources?.confluence !== false;
    const enableGitHub = sources?.github !== false;
    const enableXray = sources?.xray !== false;

    const sourcesQueried: string[] = [];
    const jiraIssues: JiraContext[] = [];
    const confluencePages: ConfluenceContext[] = [];
    let commitContext: EnrichmentResult['context']['codeChanges']['commit'];
    let prContext: PullRequestContext | undefined;
    let xrayContext: XrayEnrichmentContext | undefined;

    // Gather context from all sources concurrently
    const tasks: Promise<void>[] = [];

    // ── Jira: search for similar issues ──
    if (enableJira && jiraService.isEnabled()) {
      tasks.push(
        this.gatherJiraContext(failure, maxResultsPerSource)
          .then(issues => {
            jiraIssues.push(...issues);
            if (issues.length > 0) sourcesQueried.push('jira');
          })
      );
    }

    // ── Confluence: search for relevant docs ──
    if (enableConfluence && confluenceService.isEnabled()) {
      tasks.push(
        this.gatherConfluenceContext(failure, maxResultsPerSource)
          .then(pages => {
            confluencePages.push(...pages);
            if (pages.length > 0) sourcesQueried.push('confluence');
          })
      );
    }

    // ── GitHub: fetch code changes for the commit ──
    if (enableGitHub && githubService.isEnabled() && failure.commitHash && input.repo) {
      tasks.push(
        this.gatherGitHubContext(input.repo, failure.commitHash)
          .then(result => {
            commitContext = result.commit;
            prContext = result.pullRequest;
            if (commitContext || prContext) sourcesQueried.push('github');
          })
      );
    }

    // ── Xray: fetch test case history for mapped tests ──
    if (enableXray && xrayService.isEnabled() && failure.externalTestCaseId) {
      tasks.push(
        this.gatherXrayContext(failure.externalTestCaseId)
          .then(result => {
            xrayContext = result;
            if (result) sourcesQueried.push('xray');
          })
      );
    }

    await Promise.allSettled(tasks);

    // Build the enrichment result
    const context: EnrichmentResult['context'] = {
      jiraIssues,
      confluencePages,
      codeChanges: {
        commit: commitContext,
        pullRequest: prContext,
      },
      xrayContext,
    };

    // Generate AI analysis if we have a provider and gathered any context
    let analysis = '';
    let confidence = 0;

    if (this.provider && sourcesQueried.length > 0) {
      const aiResult = await this.synthesizeAnalysis(failure, context, sourcesQueried);
      analysis = aiResult.analysis;
      confidence = aiResult.confidence;
    } else if (sourcesQueried.length > 0) {
      analysis = this.buildBasicSummary(context, sourcesQueried);
      confidence = 0.3;
    } else {
      analysis = 'No additional context found from external sources.';
      confidence = 0;
    }

    return { analysis, confidence, context, sourcesQueried };
  }

  // ── Jira context gathering ─────────────────────────────────────────────

  private async gatherJiraContext(
    failure: TestFailure,
    maxResults: number
  ): Promise<JiraContext[]> {
    try {
      const issues = await jiraService.searchSimilarIssues(
        failure.errorMessage,
        failure.testName,
        { maxResults }
      );

      return issues.map((issue: JiraIssueResponse) => ({
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
        type: issue.fields.issuetype.name,
        priority: issue.fields.priority as string | undefined,
        assignee: issue.fields.assignee as string | undefined,
        url: `${issue.key}`, // Jira base URL is added client-side
      }));
    } catch (error) {
      logger.warn('Failed to gather Jira context:', error);
      return [];
    }
  }

  // ── Confluence context gathering ───────────────────────────────────────

  private async gatherConfluenceContext(
    failure: TestFailure,
    maxResults: number
  ): Promise<ConfluenceContext[]> {
    try {
      // Build search query from error message and test name
      const searchQuery = [failure.testName, failure.errorMessage.substring(0, 100)]
        .filter(Boolean)
        .join(' ');

      return await confluenceService.searchContent(searchQuery, {
        maxResults,
        labels: ['rca', 'runbook', 'architecture', 'troubleshooting'],
      });
    } catch (error) {
      logger.warn('Failed to gather Confluence context:', error);
      return [];
    }
  }

  // ── GitHub context gathering ───────────────────────────────────────────

  private async gatherGitHubContext(
    repoSlug: string,
    commitSha: string
  ): Promise<{ commit?: EnrichmentResult['context']['codeChanges']['commit']; pullRequest?: PullRequestContext }> {
    const [owner, repo] = repoSlug.split('/');
    if (!owner || !repo) return {};

    try {
      // Fetch commit diff and PR info concurrently
      const [commitData, prData] = await Promise.allSettled([
        githubService.getCommitChanges(owner, repo, commitSha),
        githubService.getPullRequestForCommit(owner, repo, commitSha),
      ]);

      let commit: EnrichmentResult['context']['codeChanges']['commit'];
      let pullRequest: PullRequestContext | undefined;

      if (commitData.status === 'fulfilled') {
        const data = commitData.value;
        commit = {
          sha: commitSha,
          message: data.message,
          // Limit patch size to avoid blowing up the AI prompt
          files: data.files.map(f => ({
            ...f,
            patch: f.patch.length > 2000 ? f.patch.substring(0, 2000) + '\n... (truncated)' : f.patch,
          })),
        };
      }

      if (prData.status === 'fulfilled' && prData.value) {
        const pr = prData.value;
        // Also fetch PR files for more complete context
        const prFiles = await githubService.getPullRequestFiles(owner, repo, pr.number);
        pullRequest = {
          ...pr,
          files: prFiles.map(f => ({
            ...f,
            patch: f.patch.length > 2000 ? f.patch.substring(0, 2000) + '\n... (truncated)' : f.patch,
          })),
        };
      }

      return { commit, pullRequest };
    } catch (error) {
      logger.warn('Failed to gather GitHub context:', error);
      return {};
    }
  }

  // ── Xray context gathering ───────────────────────────────────────────

  private async gatherXrayContext(
    testCaseKey: string
  ): Promise<XrayEnrichmentContext | undefined> {
    try {
      const history = await xrayService.getTestCaseHistory(testCaseKey);
      return history;
    } catch (error) {
      logger.warn('Failed to gather Xray context:', error);
      return undefined;
    }
  }

  // ── AI synthesis ───────────────────────────────────────────────────────

  private async synthesizeAnalysis(
    failure: TestFailure,
    context: EnrichmentResult['context'],
    sourcesQueried: string[]
  ): Promise<{ analysis: string; confidence: number }> {
    if (!this.provider) {
      return { analysis: this.buildBasicSummary(context, sourcesQueried), confidence: 0.3 };
    }

    try {
      const systemPrompt = `You are a senior QA engineer analyzing a test failure with additional context from the team's tools. Your job is to connect the dots across Jira issues, Confluence documentation, and code changes to produce an actionable root cause analysis.

Be specific and concise. Focus on:
1. Whether any existing Jira issues match this failure (potential duplicates)
2. Whether Confluence docs contain relevant troubleshooting steps or known issues
3. Whether recent code changes (commits/PRs) could have caused this failure
4. A recommended next action (e.g., "link to PROJ-123", "apply fix from runbook X", "investigate PR #45")`;

      const userPrompt = this.buildAnalysisPrompt(failure, context);

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const response = await this.provider.chat(messages, {
        maxTokens: 1500,
        temperature: 0.3,
      });

      // Parse confidence from the response if included, otherwise estimate
      const confidence = this.estimateConfidence(context, sourcesQueried);

      return { analysis: response.content, confidence };
    } catch (error) {
      logger.error('AI synthesis failed, falling back to basic summary:', error);
      return { analysis: this.buildBasicSummary(context, sourcesQueried), confidence: 0.2 };
    }
  }

  private buildAnalysisPrompt(
    failure: TestFailure,
    context: EnrichmentResult['context']
  ): string {
    let prompt = `## Test Failure
**Test:** ${failure.testName}
**Error:** ${failure.errorMessage}
**Branch:** ${failure.branch}
**Commit:** ${failure.commitHash}
**Pipeline:** ${failure.pipeline}`;

    if (failure.stackTrace) {
      prompt += `\n**Stack Trace (first 500 chars):**\n\`\`\`\n${failure.stackTrace.substring(0, 500)}\n\`\`\``;
    }

    // Jira context
    if (context.jiraIssues.length > 0) {
      prompt += '\n\n## Potentially Related Jira Issues\n';
      for (const issue of context.jiraIssues) {
        prompt += `- **${issue.key}** [${issue.status}] (${issue.type}): ${issue.summary}\n`;
      }
    }

    // Confluence context
    if (context.confluencePages.length > 0) {
      prompt += '\n\n## Relevant Confluence Documentation\n';
      for (const page of context.confluencePages) {
        prompt += `- **${page.title}** (labels: ${page.labels.join(', ') || 'none'})\n  Excerpt: ${page.excerpt.substring(0, 200)}\n`;
      }
    }

    // Code changes
    if (context.codeChanges.pullRequest) {
      const pr = context.codeChanges.pullRequest;
      prompt += `\n\n## Associated Pull Request\n**PR #${pr.number}:** ${pr.title} (by ${pr.author})\n`;
      if (pr.body) {
        prompt += `**Description:** ${pr.body.substring(0, 300)}\n`;
      }
      prompt += `**Files changed:** ${pr.files.length}\n`;
      // Show the most relevant files (those matching stack trace paths)
      const relevantFiles = this.findRelevantFiles(failure, pr.files);
      if (relevantFiles.length > 0) {
        prompt += '\n**Files potentially related to the failure:**\n';
        for (const f of relevantFiles.slice(0, 5)) {
          prompt += `\`${f.filename}\` (+${f.additions}/-${f.deletions})\n`;
          if (f.patch) {
            prompt += `\`\`\`diff\n${f.patch.substring(0, 500)}\n\`\`\`\n`;
          }
        }
      }
    } else if (context.codeChanges.commit) {
      const commit = context.codeChanges.commit;
      prompt += `\n\n## Commit\n**Message:** ${commit.message}\n**Files changed:** ${commit.files.length}\n`;
      const relevantFiles = this.findRelevantFiles(failure, commit.files);
      if (relevantFiles.length > 0) {
        prompt += '\n**Files potentially related to the failure:**\n';
        for (const f of relevantFiles.slice(0, 5)) {
          prompt += `\`${f.filename}\` (+${f.additions}/-${f.deletions})\n`;
          if (f.patch) {
            prompt += `\`\`\`diff\n${f.patch.substring(0, 500)}\n\`\`\`\n`;
          }
        }
      }
    }

    // Xray context
    if (context.xrayContext) {
      const xray = context.xrayContext;
      prompt += `\n\n## Xray Test Case History\n**Test Case:** ${xray.testCaseKey} — ${xray.summary} [${xray.status}]\n`;
      if (xray.executionHistory.length > 0) {
        prompt += '**Recent Executions:**\n';
        for (const exec of xray.executionHistory) {
          prompt += `- ${exec.date}: ${exec.status} (${exec.executionKey})\n`;
        }
      }
      if (xray.linkedDefects.length > 0) {
        prompt += '**Linked Defects:**\n';
        for (const defect of xray.linkedDefects) {
          prompt += `- ${defect.key}: ${defect.summary} [${defect.status}]\n`;
        }
      }
    }

    prompt += '\n\nProvide a concise analysis connecting these dots. What is the most likely root cause and recommended action?';

    return prompt;
  }

  /**
   * Find files from a diff that are most likely related to the failure,
   * based on stack trace file paths and error messages.
   */
  private findRelevantFiles(
    failure: TestFailure,
    files: CodeChange[]
  ): CodeChange[] {
    if (!failure.stackTrace && !failure.errorMessage) return files;

    const context = `${failure.stackTrace || ''} ${failure.errorMessage}`.toLowerCase();

    // Score each file based on whether its name appears in the failure context
    const scored = files.map(f => {
      const basename = f.filename.split('/').pop()?.toLowerCase() || '';
      const fullpath = f.filename.toLowerCase();
      let score = 0;
      if (context.includes(fullpath)) score += 10;
      if (context.includes(basename)) score += 5;
      // Boost test files and source files
      if (basename.includes('test') || basename.includes('spec')) score += 2;
      return { file: f, score };
    });

    // Return files sorted by relevance score, then all files if none matched
    const relevant = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
    return relevant.length > 0 ? relevant.map(s => s.file) : files.slice(0, 5);
  }

  private estimateConfidence(
    context: EnrichmentResult['context'],
    sourcesQueried: string[]
  ): number {
    let confidence = 0.3; // Base confidence
    if (sourcesQueried.includes('jira') && context.jiraIssues.length > 0) confidence += 0.2;
    if (sourcesQueried.includes('confluence') && context.confluencePages.length > 0) confidence += 0.15;
    if (sourcesQueried.includes('github')) {
      if (context.codeChanges.pullRequest) confidence += 0.25;
      else if (context.codeChanges.commit) confidence += 0.15;
    }
    if (sourcesQueried.includes('xray') && context.xrayContext) confidence += 0.15;
    return Math.min(confidence, 0.95);
  }

  private buildBasicSummary(
    context: EnrichmentResult['context'],
    _sourcesQueried: string[]
  ): string {
    const parts: string[] = [];

    if (context.jiraIssues.length > 0) {
      const issueList = context.jiraIssues.map(i => `${i.key}: ${i.summary} [${i.status}]`).join('; ');
      parts.push(`Found ${context.jiraIssues.length} potentially related Jira issue(s): ${issueList}`);
    }

    if (context.confluencePages.length > 0) {
      const pageList = context.confluencePages.map(p => p.title).join('; ');
      parts.push(`Found ${context.confluencePages.length} relevant Confluence page(s): ${pageList}`);
    }

    if (context.codeChanges.pullRequest) {
      const pr = context.codeChanges.pullRequest;
      parts.push(`Associated PR #${pr.number}: "${pr.title}" by ${pr.author} (${pr.files.length} files changed)`);
    } else if (context.codeChanges.commit) {
      const c = context.codeChanges.commit;
      parts.push(`Commit ${c.sha.substring(0, 8)}: "${c.message}" (${c.files.length} files changed)`);
    }

    if (context.xrayContext) {
      const xray = context.xrayContext;
      const failCount = xray.executionHistory.filter(e => e.status === 'FAIL').length;
      parts.push(`Xray test case ${xray.testCaseKey}: ${xray.summary} [${xray.status}] — ${failCount}/${xray.executionHistory.length} recent executions failed`);
      if (xray.linkedDefects.length > 0) {
        const defectKeys = xray.linkedDefects.map(d => d.key).join(', ');
        parts.push(`Linked defects: ${defectKeys}`);
      }
    }

    return parts.length > 0
      ? parts.join('\n\n')
      : 'No additional context found from external sources.';
  }
}

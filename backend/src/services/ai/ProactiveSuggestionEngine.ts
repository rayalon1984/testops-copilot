/**
 * ProactiveSuggestionEngine — AI-in-the-Loop Suggestions
 *
 * Runs after each tool result in the ReAct loop. Evaluates post-conditions
 * and emits proactive suggestions when the AI can anticipate the user's
 * next action.
 *
 * Examples:
 *   - Searched Jira, found nothing → suggest creating a ticket
 *   - Identified transient failure → suggest retry with play button
 *   - Found related issues → suggest linking them
 *   - RCA complete with known fix → suggest applying it
 *
 * See specs/AUTONOMOUS_AI_SPEC.md § Feature 1.
 */

import { ToolResult } from './tools/types';
import { logger } from '@/utils/logger';

export interface ProactiveSuggestion {
    /** Unique ID for tracking acceptance rates */
    suggestionId: string;
    /** The tool to suggest invoking */
    tool: string;
    /** Pre-filled arguments for the suggested tool call */
    preparedArgs: Record<string, unknown>;
    /** Human-readable reason for the suggestion */
    reason: string;
    /** Confidence that this is the right next action (0.0–1.0) */
    confidence: number;
    /** Which autonomy tier the suggestion falls into */
    tier: 1 | 2;
    /** Short action label for the button (e.g., "Create Issue", "Retry Now") */
    actionLabel: string;
    /** Optional secondary action (e.g., "Edit First", "Skip") */
    secondaryLabel?: string;
}

/** Context about the conversation state for evaluating suggestions */
interface SuggestionContext {
    /** The tool that just executed */
    toolName: string;
    /** Result from the tool execution */
    toolResult: ToolResult;
    /** All tool results collected so far in this ReAct loop */
    previousResults: { name: string; result: ToolResult }[];
    /** The original user message */
    userMessage: string;
}

let suggestionCounter = 0;
function generateSuggestionId(): string {
    return `suggestion-${Date.now()}-${++suggestionCounter}`;
}

/**
 * Evaluate whether a proactive suggestion should be emitted after a tool result.
 * Returns null if no suggestion is appropriate.
 */
export function evaluateSuggestion(ctx: SuggestionContext): ProactiveSuggestion | null {
    const { toolName, toolResult, previousResults, userMessage } = ctx;

    // Rule 1: Jira search returned empty → suggest creating an issue
    if (toolName === 'jira_search' && toolResult.success) {
        const data = toolResult.data as Record<string, unknown> | undefined;
        const issues = data?.issues as unknown[] | undefined;
        if (!issues || issues.length === 0) {
            return {
                suggestionId: generateSuggestionId(),
                tool: 'jira_create_issue',
                preparedArgs: buildJiraIssueFromContext(userMessage, previousResults),
                reason: 'No existing Jira issue found for this failure. Here\'s a draft:',
                confidence: 0.8,
                tier: 2,
                actionLabel: 'Create Issue',
                secondaryLabel: 'Edit First',
            };
        }
    }

    // Rule 2: Test failure with transient/env root cause → suggest retry
    if (toolName === 'failure_predictions' && toolResult.success) {
        const data = toolResult.data as Record<string, unknown> | undefined;
        const predictions = data?.predictions as Array<Record<string, unknown>> | undefined;
        if (predictions) {
            const transientFailures = predictions.filter(p => {
                const cause = String(p.rootCause || p.category || '').toLowerCase();
                return cause.includes('environment') ||
                       cause.includes('transient') ||
                       cause.includes('timeout') ||
                       cause.includes('network') ||
                       cause.includes('flaky');
            });
            if (transientFailures.length > 0) {
                const testName = String(transientFailures[0].testName || transientFailures[0].name || 'affected test');
                return {
                    suggestionId: generateSuggestionId(),
                    tool: 'testrun_retry',
                    preparedArgs: {
                        testId: transientFailures[0].testId || transientFailures[0].id,
                        reason: 'Transient failure detected — environment/network issue',
                    },
                    reason: `${testName} failed due to a transient issue. ${transientFailures.length > 1 ? `${transientFailures.length} tests affected.` : ''}`,
                    confidence: 0.85,
                    tier: 2,
                    actionLabel: transientFailures.length > 1 ? `Retry All ${transientFailures.length}` : 'Retry Now',
                    secondaryLabel: 'Skip',
                };
            }
        }
    }

    // Rule 3: Jenkins status shows failure → suggest rerun if recent
    if (toolName === 'jenkins_get_status' && toolResult.success) {
        const data = toolResult.data as Record<string, unknown> | undefined;
        const status = String(data?.status || data?.result || '').toLowerCase();
        if (status === 'failure' || status === 'failed') {
            return {
                suggestionId: generateSuggestionId(),
                tool: 'jenkins_trigger_build',
                preparedArgs: {
                    jobName: data?.jobName || data?.name,
                },
                reason: 'Pipeline is failing. Want to trigger a rebuild?',
                confidence: 0.7,
                tier: 2,
                actionLabel: 'Trigger Build',
                secondaryLabel: 'Investigate First',
            };
        }
    }

    // Rule 4: Found related Jira issues during investigation → suggest linking
    if (toolName === 'jira_search' && toolResult.success) {
        const data = toolResult.data as Record<string, unknown> | undefined;
        const issues = data?.issues as Array<Record<string, unknown>> | undefined;
        if (issues && issues.length >= 2) {
            // Check if previous results also had Jira context (indicates cross-issue investigation)
            const hasJiraGet = previousResults.some(r => r.name === 'jira_get');
            if (hasJiraGet) {
                const previousIssue = previousResults
                    .filter(r => r.name === 'jira_get')
                    .map(r => (r.result.data as Record<string, unknown>)?.key)
                    .filter(Boolean)[0];

                if (previousIssue) {
                    return {
                        suggestionId: generateSuggestionId(),
                        tool: 'jira_link_issues',
                        preparedArgs: {
                            sourceKey: previousIssue,
                            targetKeys: issues.slice(0, 3).map(i => i.key).filter(k => k !== previousIssue),
                            linkType: 'relates to',
                        },
                        reason: `Found ${issues.length} related issues. Link them to ${previousIssue}?`,
                        confidence: 0.75,
                        tier: 1,
                        actionLabel: 'Link Issues',
                        secondaryLabel: 'Dismiss',
                    };
                }
            }
        }
    }

    // Rule 5: GitHub PR found → suggest merge if CI is passing
    if (toolName === 'github_get_pr' && toolResult.success) {
        const data = toolResult.data as Record<string, unknown> | undefined;
        const state = String(data?.state || '').toLowerCase();
        const mergeable = data?.mergeable;
        if (state === 'open' && mergeable === true) {
            return {
                suggestionId: generateSuggestionId(),
                tool: 'github_merge_pr',
                preparedArgs: {
                    prNumber: data?.number,
                    repo: data?.repo || data?.repository,
                },
                reason: 'PR is open and mergeable. Checks are passing.',
                confidence: 0.7,
                tier: 2,
                actionLabel: 'Merge PR',
                secondaryLabel: 'Review Diff',
            };
        }
    }

    // No suggestion appropriate
    return null;
}

/**
 * Build Jira issue fields from conversation context (user message + previous tool results).
 * Used to pre-fill the "Create Issue" suggestion card.
 */
function buildJiraIssueFromContext(
    userMessage: string,
    previousResults: { name: string; result: ToolResult }[]
): Record<string, unknown> {
    // Extract failure details from prediction or dashboard results
    let summary = 'Investigation: ' + userMessage.slice(0, 100);
    let description = `This issue was suggested by the AI copilot during investigation.\n\nOriginal query: ${userMessage}`;
    const labels: string[] = ['ai-suggested'];

    for (const { name, result } of previousResults) {
        if (!result.success || !result.data) continue;
        const data = result.data as Record<string, unknown>;

        if (name === 'failure_predictions') {
            const predictions = data.predictions as Array<Record<string, unknown>> | undefined;
            if (predictions?.[0]) {
                const first = predictions[0];
                summary = `${first.testName || first.name || 'Test'}: ${first.rootCause || first.category || 'failure investigation'}`;
                description += `\n\n**Failure Analysis**:\n- Test: ${first.testName || first.name}\n- Category: ${first.category || 'Unknown'}\n- Risk Score: ${first.riskScore || 'N/A'}`;
                labels.push('failure-analysis');
            }
        }

        if (name === 'jenkins_get_status') {
            const jobName = data.jobName || data.name;
            if (jobName) {
                description += `\n\n**Pipeline**: ${jobName}\n- Status: ${data.status || data.result}`;
                labels.push('pipeline-failure');
            }
        }
    }

    logger.info(`[ProactiveSuggestionEngine] Built Jira issue: "${summary}" with ${labels.length} labels`);

    return {
        summary,
        description,
        issueType: 'Bug',
        labels,
        priority: 'Medium',
    };
}

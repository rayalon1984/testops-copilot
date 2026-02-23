/**
 * Compact Prompts — Tier-Aware Prompt Templates
 *
 * Provides compact prompt variants for small models (3B-12B).
 * Small models struggle with:
 *  - Long system prompts (limited instruction following at length)
 *  - Complex JSON schemas (nested objects, many optional fields)
 *  - Multi-step reasoning without explicit guidance
 *
 * This module provides simplified prompts that:
 *  - Are shorter (under ~400 tokens for system prompts)
 *  - Request simpler output formats (flat JSON, fewer fields)
 *  - Focus on the core task without extra instructions
 */

import { ModelTier, getPromptHints } from './model-tiers';
import { TestFailure } from './types';

// ── Categorization Prompts ──────────────────────────────────────────────

/**
 * Get the system prompt for failure categorization based on model tier.
 */
export function getCategorizationSystemPrompt(tier: ModelTier): string {
  if (tier === 'small') {
    return `Classify the test failure into one category.

Categories: bug_critical, bug_minor, environment, flaky, configuration, unknown

Respond with JSON only:
{"category": "...", "confidence": 0.0-1.0, "reasoning": "one sentence"}`;
  }

  if (tier === 'medium') {
    return `You are a QA engineer. Categorize this test failure.

Categories:
- bug_critical: crashes, data corruption, security issues
- bug_minor: UI glitches, minor errors
- environment: network, database, resource issues
- flaky: timing, race conditions, non-deterministic
- configuration: wrong env vars, missing config
- unknown: cannot determine

Respond ONLY in JSON:
{"category": "...", "confidence": 0.0-1.0, "reasoning": "brief explanation", "suggestedAction": "next step"}`;
  }

  // Large model — use the full prompt (existing behavior)
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
 * Build the categorization user prompt, adapted for model tier.
 */
export function buildCategorizationPrompt(failure: TestFailure, tier: ModelTier): string {
  const hints = getPromptHints(tier);

  let prompt = `Test: ${failure.testName}\n`;
  prompt += `Error: ${failure.errorMessage}\n`;

  if (tier === 'small') {
    // Minimal context for small models
    if (failure.stackTrace) {
      const lines = failure.stackTrace.split('\n').slice(0, 5);
      prompt += `Stack: ${lines.join('\n')}\n`;
    }
    return prompt;
  }

  // Medium and large models get more context
  prompt += `Pipeline: ${failure.pipeline}\nBranch: ${failure.branch}\n\n`;

  if (failure.stackTrace) {
    const maxLines = tier === 'medium' ? 10 : 15;
    const truncatedStack = failure.stackTrace.split('\n').slice(0, maxLines).join('\n');
    prompt += `Stack Trace:\n\`\`\`\n${truncatedStack}\n\`\`\`\n\n`;
  }

  if (failure.logSnippet) {
    const maxChars = hints.maxCodeSnippetChars;
    const truncatedLog = failure.logSnippet.substring(0, maxChars);
    prompt += `Log Snippet:\n\`\`\`\n${truncatedLog}\n\`\`\`\n\n`;
  }

  prompt += 'Categorize this failure.';
  return prompt;
}

// ── Log Summarization Prompts ───────────────────────────────────────────

/**
 * Get the system prompt for log summarization based on model tier.
 */
export function getLogSummarySystemPrompt(tier: ModelTier): string {
  if (tier === 'small') {
    // Small models can't reliably produce complex JSON — use a simpler format
    return `Summarize this test failure log.

Respond with JSON only:
{"summary": "2 sentences", "rootCause": "one sentence", "suggestedFix": "one sentence", "confidence": 0.0-1.0}`;
  }

  if (tier === 'medium') {
    return `You are a DevOps engineer analyzing test failure logs.

Identify the root cause, key log lines, and suggest a fix.

Respond in JSON:
{
  "summary": "2-3 sentence summary",
  "rootCause": "specific root cause",
  "keyLogLines": [{"lineNumber": 1, "content": "...", "relevance": "high|medium|low"}],
  "suggestedFix": "actionable fix",
  "confidence": 0.0-1.0
}`;
  }

  // Large model — full prompt
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

// ── Persona Router Prompt ───────────────────────────────────────────────

/**
 * Get the persona classification prompt based on model tier.
 */
export function getPersonaClassificationPrompt(tier: ModelTier): string {
  if (tier === 'small') {
    return `Classify this query into one persona:
SECURITY_ENGINEER, TEST_ENGINEER, DEVOPS_ENGINEER, PERFORMANCE_ENGINEER, DATA_ENGINEER, SENIOR_ENGINEER

JSON only: {"persona": "...", "confidence": 0.0-1.0}`;
  }

  // Medium and large use the full prompt (already ~200 tokens)
  return `You are a query classifier for a TestOps platform's virtual team.
Classify the user's query into exactly ONE persona from this list:

- SECURITY_ENGINEER: auth, secrets, vulnerabilities, security posture
- AI_ARCHITECT: AI config, provider selection, LLM behavior, tool policy
- DATA_ENGINEER: database, schema, migrations, query performance, data integrity
- UX_DESIGNER: UI/UX flows, design, accessibility, visual hierarchy
- PERFORMANCE_ENGINEER: latency, throughput, profiling, load testing, memory
- TEST_ENGINEER: test failures, flaky tests, coverage, CI quality, test strategy
- DEVOPS_ENGINEER: pipelines, deployments, Docker, CI/CD, build infra
- AI_PRODUCT_MANAGER: feature discovery, capabilities, roadmap, getting started
- SENIOR_ENGINEER: general implementation, operational, anything else

Respond with ONLY a JSON object (no markdown, no explanation):
{"persona": "PERSONA_KEY", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;
}

// ── Chat System Prompt ──────────────────────────────────────────────────

/**
 * Build the chat system prompt, with tool definitions sized for the model tier.
 */
export function buildTieredSystemPrompt(
  roleContext: string,
  personaBlock: string,
  toolDefs: string,
  tier: ModelTier,
  maxToolCalls: number
): string {
  if (tier === 'small') {
    // Minimal system prompt for small models — no tool calling support
    return `You are TestOps Copilot, an AI assistant for test operations.
${roleContext}
${personaBlock}
Be concise. Use Markdown. Never fabricate data.`;
  }

  if (tier === 'medium') {
    // Medium: include tools but shorter instructions
    return `You are TestOps Copilot, an AI assistant for test operations.
${roleContext}
${personaBlock}
## Tools
Call tools with: \`\`\`tool_call\n{"tool": "name", "args": {...}}\n\`\`\`

${toolDefs}

Rules: Use tools for data. Max ${maxToolCalls} calls. Be concise. Markdown format.`;
  }

  // Large: full system prompt (existing behavior)
  return `You are TestOps Copilot, an intelligent assistant for the TestOps Companion platform.
${roleContext}
${personaBlock}
## Available Tools
You can use the following tools to look up information. To call a tool, respond with a JSON block like:
\`\`\`tool_call
{"tool": "tool_name", "args": {"param1": "value1"}}
\`\`\`

After receiving tool results, reason about them and provide a helpful answer.

${toolDefs}

## Rules
1. Always use tools when the user asks about test failures, Jira issues, pipelines, or documentation.
2. You may call multiple tools in sequence, but no more than ${maxToolCalls} tool calls per request.
3. If a tool fails, explain the issue gracefully and suggest alternatives.
4. Format your responses in Markdown for readability.
5. Be concise but thorough. Include relevant links and data.
6. Never fabricate data — if you don't have information, say so.`;
}

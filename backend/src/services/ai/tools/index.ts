/**
 * AI Tools — Barrel Export & Auto-Registration
 *
 * Imports all tool modules and registers them with the ToolRegistry.
 * Import this file once at app startup.
 */

import { toolRegistry } from './registry';

// Phase 1: Read-only tools
import { jiraSearchTool, jiraGetTool } from './jira';
import { githubGetCommitTool, githubGetPRTool } from './github';
import { confluenceSearchTool } from './confluence';
import { jenkinsGetStatusTool } from './jenkins';
import { dashboardMetricsTool } from './dashboard';
import { failurePredictionsTool } from './predictions';

// Phase 2: Write tools (require confirmation)
import { githubCreatePRTool } from './github-write';
import { githubCreateBranchTool, githubUpdateFileTool } from './github-advanced-write';
import { jiraCreateIssueTool, jiraTransitionIssueTool, jiraCommentTool } from './jira-write';

// Phase 3: Action-gap tools (require confirmation)
import { jenkinsTriggerBuildTool } from './jenkins-write';
import { testrunCancelTool, testrunRetryTool } from './testrun';
import { githubRerunWorkflowTool } from './github-workflow';

// Register all Phase 1 tools
const phase1Tools = [
    jiraSearchTool,
    jiraGetTool,
    githubGetCommitTool,
    githubGetPRTool,
    confluenceSearchTool,
    jenkinsGetStatusTool,
    dashboardMetricsTool,
    failurePredictionsTool,
];

// Register all Phase 2 tools
const phase2Tools = [
    githubCreatePRTool,
    githubCreateBranchTool,
    githubUpdateFileTool,
    jiraCreateIssueTool,
    jiraTransitionIssueTool,
    jiraCommentTool,
];

// Register all Phase 3 tools
const phase3Tools = [
    jenkinsTriggerBuildTool,
    testrunCancelTool,
    testrunRetryTool,
    githubRerunWorkflowTool,
];

[...phase1Tools, ...phase2Tools, ...phase3Tools].forEach(tool => toolRegistry.register(tool));

// Re-export for convenience
export { toolRegistry } from './registry';
export type { Tool, ToolResult, ToolContext, ToolSchema, SSEEvent, SSEEventType } from './types';
export { hasRequiredRole, ROLE_HIERARCHY } from './types';

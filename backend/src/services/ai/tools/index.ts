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
import { rcaIdentifyTool } from './rca';
import { xraySearchTool } from './xray';

// Phase 2: Write tools (require confirmation)
import { githubCreatePRTool } from './github-write';
import { githubCreateBranchTool, githubUpdateFileTool } from './github-advanced-write';
import { jiraCreateIssueTool, jiraTransitionIssueTool, jiraCommentTool } from './jira-write';

// Phase 3: Action-gap tools (require confirmation)
import { jenkinsTriggerBuildTool } from './jenkins-write';
import { testrunCancelTool, testrunRetryTool } from './testrun';
import { githubRerunWorkflowTool } from './github-workflow';

// Sprint 7: New tools (Autonomous AI & Proactive UX)
import { giphySearchTool } from './giphy';
import { jiraLinkIssuesTool, jiraAddLabelTool } from './jira-housekeeping';
import { githubMergePRTool } from './github-merge';

// Register all Phase 1 tools (read-only, no confirmation)
const phase1Tools = [
    jiraSearchTool,
    jiraGetTool,
    githubGetCommitTool,
    githubGetPRTool,
    confluenceSearchTool,
    jenkinsGetStatusTool,
    dashboardMetricsTool,
    failurePredictionsTool,
    giphySearchTool,          // Sprint 7: personality GIFs
    rcaIdentifyTool,          // Root cause analysis (card redesign)
    jiraLinkIssuesTool,       // Sprint 7: auto-link related issues (Tier 1)
    jiraAddLabelTool,         // Sprint 7: auto-label issues (Tier 1)
    xraySearchTool,           // Sprint 11: Xray test case search (Tier 1)
];

// Register all Phase 2 tools (write, require confirmation)
const phase2Tools = [
    githubCreatePRTool,
    githubCreateBranchTool,
    githubUpdateFileTool,
    jiraCreateIssueTool,
    jiraTransitionIssueTool,
    jiraCommentTool,
    githubMergePRTool,        // Sprint 7: merge PR from chat (Tier 2)
];

// Register all Phase 3 tools (action-gap, context-dependent)
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

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

// Phase 2: Write tools
import { githubCreatePRTool } from './github-write';
import { jiraCreateIssueTool, jiraTransitionIssueTool, jiraCommentTool } from './jira-write';

// Register all Phase 1 tools
const phase1Tools = [
    jiraSearchTool,
    jiraGetTool,
    githubGetCommitTool,
    githubGetPRTool,
    confluenceSearchTool,
    jenkinsGetStatusTool,
    dashboardMetricsTool,
];

// Register all Phase 2 tools
const phase2Tools = [
    githubCreatePRTool,
    jiraCreateIssueTool,
    jiraTransitionIssueTool,
    jiraCommentTool,
];

[...phase1Tools, ...phase2Tools].forEach(tool => toolRegistry.register(tool));

// Re-export for convenience
export { toolRegistry } from './registry';
export type { Tool, ToolResult, ToolContext, ToolSchema, SSEEvent, SSEEventType } from './types';

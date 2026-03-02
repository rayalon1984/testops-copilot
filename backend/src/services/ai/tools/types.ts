/**
 * Agentic AI Tools — Core Type Definitions
 *
 * Defines the Tool interface, parameter schemas, and execution context
 * shared by all AI tools in the system.
 */

/**
 * Execution context passed to every tool when it runs.
 * Provides access to user identity and session metadata.
 */
export interface ToolContext {
    userId: string;
    userRole: string;          // 'admin' | 'manager' | 'engineer' | 'viewer'
    sessionId: string;
    organizationId?: string;
}

/**
 * JSON-Schema-like parameter definition for tool inputs.
 * Used to generate the tool description sent to the LLM.
 */
export interface ToolParameter {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    required: boolean;
    enum?: string[];
    default?: unknown;
}

/**
 * Schema describing a tool for the LLM system prompt.
 */
export interface ToolSchema {
    name: string;
    description: string;
    parameters: ToolParameter[];
}

/**
 * Result returned by a tool after execution.
 */
export interface ToolResult {
    success: boolean;
    data?: unknown;
    error?: string;
    /** If true, the AI should ask the user to confirm before proceeding. */
    confirmationNeeded?: boolean;
    /** Human-readable summary of what the tool did / wants to do. */
    summary: string;
}

/**
 * The core Tool interface. Every AI tool must implement this.
 */
export interface Tool {
    /** Unique tool identifier (snake_case), e.g. 'jira_search' */
    name: string;

    /** Human-readable description shown to the LLM */
    description: string;

    /** Category for grouping in UI and logs */
    category: 'jira' | 'github' | 'confluence' | 'jenkins' | 'slack' | 'dashboard' | 'monday' | 'xray';

    /** Parameter definitions for the LLM */
    parameters: ToolParameter[];

    /** If true, execution requires user confirmation (Phase 2 write tools) */
    requiresConfirmation: boolean;

    /**
     * Minimum role required to use this tool.
     * Checked in the ReAct loop before execution.
     * Omit for tools accessible to all authenticated users.
     * Values: 'ADMIN' | 'EDITOR' | 'USER' | 'BILLING' | 'VIEWER'
     */
    requiredRole?: string;

    /**
     * Execute the tool with the given arguments and context.
     * Must handle its own errors gracefully and return a ToolResult.
     */
    execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}

/**
 * Role hierarchy for authorization checks.
 * Higher number = more privileges.
 */
export const ROLE_HIERARCHY: Record<string, number> = {
    ADMIN: 40,
    EDITOR: 30,
    USER: 30,
    BILLING: 20,
    VIEWER: 10,
};

/**
 * Check if the user's role meets the required minimum.
 */
export function hasRequiredRole(userRole: string, requiredRole: string): boolean {
    const userLevel = ROLE_HIERARCHY[userRole?.toUpperCase()] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole?.toUpperCase()] ?? 0;
    return userLevel >= requiredLevel;
}

/**
 * SSE event types streamed to the frontend during a chat.
 */
export type SSEEventType =
    | 'thinking'       // LLM is reasoning
    | 'persona_selected' // Virtual team persona routed for this query
    | 'tool_start'     // About to call a tool
    | 'tool_result'    // Tool returned a result
    | 'confirmation_request'  // Write-tool needs user approval (Tier 3)
    | 'confirmation_resolved' // User approved/denied
    | 'proactive_suggestion'  // AI suggests a next action (Tier 2 card)
    | 'autonomous_action'     // AI auto-executed a Tier 1 action (notify after)
    | 'answer_chunk'   // Partial answer chunk for typewriter streaming
    | 'answer'         // Final complete response text
    | 'error'          // Something went wrong
    | 'done';          // Stream complete

export interface SSEEvent {
    type: SSEEventType;
    /** Tool name (for tool_start / tool_result) */
    tool?: string;
    /** Event payload */
    data: string;
    /** Timestamp */
    timestamp: string;
}

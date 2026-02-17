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
    category: 'jira' | 'github' | 'confluence' | 'jenkins' | 'slack' | 'dashboard' | 'monday';

    /** Parameter definitions for the LLM */
    parameters: ToolParameter[];

    /** If true, execution requires user confirmation (Phase 2 write tools) */
    requiresConfirmation: boolean;

    /**
     * Execute the tool with the given arguments and context.
     * Must handle its own errors gracefully and return a ToolResult.
     */
    execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}

/**
 * SSE event types streamed to the frontend during a chat.
 */
export type SSEEventType =
    | 'thinking'       // LLM is reasoning
    | 'tool_start'     // About to call a tool
    | 'tool_result'    // Tool returned a result
    | 'confirmation_request'  // Write-tool needs user approval
    | 'confirmation_resolved' // User approved/denied
    | 'answer'         // Final response text
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

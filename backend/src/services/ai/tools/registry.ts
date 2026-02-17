/**
 * Tool Registry — Singleton that manages all available AI tools.
 *
 * Responsibilities:
 *  - Registers tool instances at startup
 *  - Looks up tools by name for the ReAct loop
 *  - Exports tool definitions formatted for the LLM system prompt
 */

import { Tool, ToolSchema } from './types';
import { logger } from '@/utils/logger';

class ToolRegistryImpl {
    private tools: Map<string, Tool> = new Map();

    /**
     * Register a tool. Throws if a tool with the same name is already registered.
     */
    register(tool: Tool): void {
        if (this.tools.has(tool.name)) {
            throw new Error(`Tool "${tool.name}" is already registered`);
        }
        this.tools.set(tool.name, tool);
        logger.info(`[ToolRegistry] Registered tool: ${tool.name} (${tool.category})`);
    }

    /**
     * Get a tool by name. Returns undefined if not found.
     */
    get(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    /**
     * Get all registered tools.
     */
    getAll(): Tool[] {
        return Array.from(this.tools.values());
    }

    /**
     * Get only read-only tools (requiresConfirmation === false).
     */
    getReadOnly(): Tool[] {
        return this.getAll().filter(t => !t.requiresConfirmation);
    }

    /**
     * Get tool schemas for the LLM system prompt.
     * Returns a structured list that can be serialized into the prompt.
     */
    getToolDefinitions(readOnlyOnly = false): ToolSchema[] {
        const tools = readOnlyOnly ? this.getReadOnly() : this.getAll();
        return tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
        }));
    }

    /**
     * Format tool definitions as a string block for injection into the system prompt.
     */
    formatForSystemPrompt(readOnlyOnly = false): string {
        const definitions = this.getToolDefinitions(readOnlyOnly);
        if (definitions.length === 0) return 'No tools available.';

        return definitions.map(def => {
            const params = def.parameters
                .map(p => {
                    const req = p.required ? '(required)' : '(optional)';
                    const enumStr = p.enum ? ` [${p.enum.join(', ')}]` : '';
                    return `    - ${p.name}: ${p.type} ${req} — ${p.description}${enumStr}`;
                })
                .join('\n');

            return `## ${def.name}\n${def.description}\nParameters:\n${params}`;
        }).join('\n\n');
    }

    /**
     * Check how many tools are registered.
     */
    get size(): number {
        return this.tools.size;
    }
}

/** Singleton instance */
export const toolRegistry = new ToolRegistryImpl();

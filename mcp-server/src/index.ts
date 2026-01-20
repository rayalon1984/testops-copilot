#!/usr/bin/env node

/**
 * TestOps Companion MCP Server
 *
 * Model Context Protocol server for AI-powered test failure analysis.
 * Provides tools for failure analysis, knowledge base management, and statistics.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import tools
import {
  analyzeTool,
  analyzeToolDefinition,
} from './tools/analyze.js';
import {
  batchAnalyzeTool,
  batchAnalyzeToolDefinition,
} from './tools/batch.js';
import {
  searchKnowledgeTool,
  searchKnowledgeToolDefinition,
  addKnowledgeTool,
  addKnowledgeToolDefinition,
  getKnowledgeStatsTool,
  getKnowledgeStatsToolDefinition,
} from './tools/knowledge.js';
import {
  getPipelineStatsTool,
  getPipelineStatsToolDefinition,
  getTestHistoryTool,
  getTestHistoryToolDefinition,
  getCostStatsTool,
  getCostStatsToolDefinition,
  healthCheckTool,
  healthCheckToolDefinition,
} from './tools/stats.js';

// Server configuration
const SERVER_NAME = process.env.MCP_SERVER_NAME || 'testops-companion';
const SERVER_VERSION = process.env.MCP_SERVER_VERSION || '1.0.0';

// Create MCP server
const server = new Server(
  {
    name: SERVER_NAME,
    version: SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool registry
const tools: Tool[] = [
  // Analysis tools
  analyzeToolDefinition as Tool,
  batchAnalyzeToolDefinition as Tool,

  // Knowledge base tools
  searchKnowledgeToolDefinition as Tool,
  addKnowledgeToolDefinition as Tool,
  getKnowledgeStatsToolDefinition as Tool,

  // Statistics tools
  getPipelineStatsToolDefinition as Tool,
  getTestHistoryToolDefinition as Tool,
  getCostStatsToolDefinition as Tool,
  healthCheckToolDefinition as Tool,
];

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      // Analysis tools
      case 'testops_analyze_failure':
        result = await analyzeTool((args || {}) as any);
        break;

      case 'testops_batch_analyze':
        result = await batchAnalyzeTool((args || {}) as any);
        break;

      // Knowledge base tools
      case 'testops_search_knowledge':
        result = await searchKnowledgeTool((args || {}) as any);
        break;

      case 'testops_add_knowledge':
        result = await addKnowledgeTool((args || {}) as any);
        break;

      case 'testops_get_knowledge_stats':
        result = await getKnowledgeStatsTool();
        break;

      // Statistics tools
      case 'testops_get_pipeline_stats':
        result = await getPipelineStatsTool((args || {}) as any);
        break;

      case 'testops_get_test_history':
        result = await getTestHistoryTool((args || {}) as any);
        break;

      case 'testops_get_cost_stats':
        result = await getCostStatsTool((args || {}) as any);
        break;

      case 'testops_health_check':
        result = await healthCheckTool();
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error executing tool ${name}:`, error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: errorMessage,
            tool: name,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  console.error('🚀 TestOps Companion MCP Server starting...');
  console.error(`📦 Version: ${SERVER_VERSION}`);
  console.error(`🔧 Tools: ${tools.length}`);

  // Validate environment
  if (!process.env.DATABASE_URL) {
    console.error('⚠️  WARNING: DATABASE_URL not set');
  }

  if (!process.env.AI_ENABLED || process.env.AI_ENABLED !== 'true') {
    console.error('⚠️  WARNING: AI features are disabled');
  }

  // Create transport
  const transport = new StdioServerTransport();

  // Connect server to transport
  await server.connect(transport);

  console.error('✅ Server ready');
  console.error('📡 Listening for requests...');
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
main().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

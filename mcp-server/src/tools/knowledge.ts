/**
 * Knowledge Base Tools - Search and add failure knowledge
 */

import { z } from 'zod';
import { query } from '../db.js';
import type { KnowledgeEntry } from '../types.js';

// Search Knowledge Schema
const SearchKnowledgeInputSchema = z.object({
  query: z.string().describe('Search query (test name, error message, or description)'),
  category: z.string().optional().describe('Filter by category (optional)'),
  limit: z.number().optional().default(10).describe('Maximum results (default: 10)'),
  onlyResolved: z.boolean().optional().default(true).describe('Only show resolved failures (default: true)'),
});

export type SearchKnowledgeInput = z.infer<typeof SearchKnowledgeInputSchema>;

/**
 * Search the knowledge base for similar failures
 *
 * Uses semantic search to find relevant past failures with known resolutions.
 * This is much cheaper than full AI analysis and should be your first step!
 *
 * Cost: ~$0.001 per search (embedding generation only)
 */
export async function searchKnowledgeTool(input: SearchKnowledgeInput): Promise<KnowledgeEntry[]> {
  console.log(`Searching knowledge base: "${input.query}"`);

  const validatedInput = SearchKnowledgeInputSchema.parse(input);

  try {
    // In production, this would use vector similarity search
    // For now, use simple text search
    let sql = `
      SELECT
        fr.id,
        fr.test_name as "testName",
        fr.error_message as "errorMessage",
        fr.category,
        fr.resolution,
        fr.resolved_by as "resolvedBy",
        fr.ticket_url as "ticketUrl",
        fr.created_at as "createdAt"
      FROM failure_records fr
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Only resolved failures
    if (validatedInput.onlyResolved) {
      sql += ` AND fr.resolved_at IS NOT NULL`;
    }

    // Category filter
    if (validatedInput.category) {
      sql += ` AND fr.category = $${paramIndex}`;
      params.push(validatedInput.category);
      paramIndex++;
    }

    // Text search
    sql += ` AND (
      fr.test_name ILIKE $${paramIndex}
      OR fr.error_message ILIKE $${paramIndex}
      OR fr.resolution ILIKE $${paramIndex}
    )`;
    params.push(`%${validatedInput.query}%`);
    paramIndex++;

    // Order by most recent first
    sql += ` ORDER BY fr.resolved_at DESC NULLS LAST, fr.created_at DESC`;

    // Limit
    sql += ` LIMIT $${paramIndex}`;
    params.push(validatedInput.limit);

    const results = await query<any>(sql, params);

    return results.map(row => ({
      id: row.id,
      testName: row.testName,
      errorMessage: row.errorMessage,
      category: row.category,
      resolution: row.resolution,
      resolvedBy: row.resolvedBy,
      ticketUrl: row.ticketUrl,
      createdAt: row.createdAt,
    }));
  } catch (error) {
    console.error('Knowledge search failed:', error);
    throw new Error(`Failed to search knowledge base: ${error}`);
  }
}

// Add Knowledge Schema
const AddKnowledgeInputSchema = z.object({
  testName: z.string().describe('Name of the test that failed'),
  errorMessage: z.string().describe('Error message'),
  stackTrace: z.string().optional().describe('Stack trace (optional)'),
  category: z.string().describe('Failure category (e.g., APPLICATION_BUG, INFRASTRUCTURE_ISSUE)'),
  resolution: z.string().describe('How the failure was resolved'),
  resolvedBy: z.string().describe('Person or system that resolved it'),
  ticketUrl: z.string().optional().describe('Link to Jira/GitHub issue (optional)'),
  pipeline: z.string().optional().describe('Pipeline name (optional)'),
  branch: z.string().optional().describe('Git branch (optional)'),
});

export type AddKnowledgeInput = z.infer<typeof AddKnowledgeInputSchema>;

/**
 * Add a new entry to the knowledge base
 *
 * Store a resolved failure for future reference. This helps build up
 * organizational knowledge over time.
 *
 * Cost: ~$0.001 (embedding generation)
 */
export async function addKnowledgeTool(input: AddKnowledgeInput): Promise<{ id: string; message: string }> {
  console.log(`Adding knowledge entry: ${input.testName}`);

  const validatedInput = AddKnowledgeInputSchema.parse(input);

  try {
    // Insert into failure_records table
    const results = await query<{ id: string }>(`
      INSERT INTO failure_records (
        test_name,
        error_message,
        stack_trace,
        category,
        resolution,
        resolved_by,
        resolved_at,
        ticket_url,
        pipeline,
        branch,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, NOW(), NOW())
      RETURNING id
    `, [
      validatedInput.testName,
      validatedInput.errorMessage,
      validatedInput.stackTrace || null,
      validatedInput.category,
      validatedInput.resolution,
      validatedInput.resolvedBy,
      validatedInput.ticketUrl || null,
      validatedInput.pipeline || null,
      validatedInput.branch || null,
    ]);

    const id = results[0].id;

    // In production, would also:
    // 1. Generate embedding
    // 2. Store in vector database
    // 3. Update search index

    return {
      id,
      message: `Successfully added knowledge entry for "${validatedInput.testName}"`,
    };
  } catch (error) {
    console.error('Failed to add knowledge:', error);
    throw new Error(`Failed to add knowledge entry: ${error}`);
  }
}

// Get Knowledge Stats
export async function getKnowledgeStatsTool(): Promise<{
  totalEntries: number;
  resolvedEntries: number;
  categories: { category: string; count: number }[];
  recentAdditions: KnowledgeEntry[];
}> {
  try {
    // Total entries
    const totalResult = await query<{ count: string }>(`
      SELECT COUNT(*) as count
      FROM failure_records
    `);
    const totalEntries = parseInt(totalResult[0].count) || 0;

    // Resolved entries
    const resolvedResult = await query<{ count: string }>(`
      SELECT COUNT(*) as count
      FROM failure_records
      WHERE resolved_at IS NOT NULL
    `);
    const resolvedEntries = parseInt(resolvedResult[0].count) || 0;

    // Categories breakdown
    const categoriesResult = await query<{ category: string; count: string }>(`
      SELECT
        category,
        COUNT(*) as count
      FROM failure_records
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
      LIMIT 10
    `);
    const categories = categoriesResult.map(row => ({
      category: row.category,
      count: parseInt(row.count) || 0,
    }));

    // Recent additions
    const recentResult = await query<any>(`
      SELECT
        id,
        test_name as "testName",
        error_message as "errorMessage",
        category,
        resolution,
        resolved_by as "resolvedBy",
        ticket_url as "ticketUrl",
        created_at as "createdAt"
      FROM failure_records
      ORDER BY created_at DESC
      LIMIT 5
    `);
    const recentAdditions = recentResult.map(row => ({
      id: row.id,
      testName: row.testName,
      errorMessage: row.errorMessage,
      category: row.category,
      resolution: row.resolution,
      resolvedBy: row.resolvedBy,
      ticketUrl: row.ticketUrl,
      createdAt: row.createdAt,
    }));

    return {
      totalEntries,
      resolvedEntries,
      categories,
      recentAdditions,
    };
  } catch (error) {
    console.error('Failed to get knowledge stats:', error);
    throw new Error(`Failed to get knowledge stats: ${error}`);
  }
}

export const searchKnowledgeToolDefinition = {
  name: 'testops_search_knowledge',
  description: `Search the knowledge base for similar past failures with known resolutions.

This is your FIRST STEP before doing expensive AI analysis! The knowledge base
contains historical failures that were already debugged and resolved by your team.

Benefits:
- Almost free (~$0.001 vs $0.05 for full AI analysis)
- Instant results (no AI inference delay)
- Team-specific solutions (not generic AI advice)
- Includes links to related tickets/PRs

Best practices:
1. Always search first before running full analysis
2. Search by test name for exact matches
3. Search by error message for similar issues
4. Filter by category if you already know the type

Example queries:
- "login test timeout"
- "database connection refused"
- "element not found selector"`,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query - test name, error message, or keywords',
      },
      category: {
        type: 'string',
        description: 'Filter by category (optional)',
        enum: [
          'INFRASTRUCTURE_ISSUE',
          'APPLICATION_BUG',
          'TEST_ISSUE',
          'FLAKY_TEST',
          'ENVIRONMENT_ISSUE',
          'TIMEOUT',
          'DEPENDENCY_FAILURE',
        ],
      },
      limit: {
        type: 'number',
        description: 'Maximum results (default: 10)',
        default: 10,
      },
      onlyResolved: {
        type: 'boolean',
        description: 'Only show resolved failures (default: true)',
        default: true,
      },
    },
    required: ['query'],
  },
};

export const addKnowledgeToolDefinition = {
  name: 'testops_add_knowledge',
  description: `Add a resolved failure to the knowledge base for future reference.

Use this when you've resolved a failure and want to help future you (or teammates)
who encounter the same issue.

What to include:
- Clear description of the failure
- Root cause analysis
- Steps taken to resolve it
- Links to related PRs/issues

This builds up organizational knowledge over time and reduces repetitive debugging.

Cost: ~$0.001 per entry`,
  inputSchema: {
    type: 'object',
    properties: {
      testName: {
        type: 'string',
        description: 'Name of the test that failed',
      },
      errorMessage: {
        type: 'string',
        description: 'Error message from the failure',
      },
      stackTrace: {
        type: 'string',
        description: 'Stack trace (optional)',
      },
      category: {
        type: 'string',
        description: 'Failure category',
        enum: [
          'INFRASTRUCTURE_ISSUE',
          'APPLICATION_BUG',
          'TEST_ISSUE',
          'FLAKY_TEST',
          'ENVIRONMENT_ISSUE',
          'TIMEOUT',
          'DEPENDENCY_FAILURE',
        ],
      },
      resolution: {
        type: 'string',
        description: 'How the failure was resolved (be specific!)',
      },
      resolvedBy: {
        type: 'string',
        description: 'Person or system that resolved it',
      },
      ticketUrl: {
        type: 'string',
        description: 'Link to Jira/GitHub issue (optional)',
      },
      pipeline: {
        type: 'string',
        description: 'Pipeline name (optional)',
      },
      branch: {
        type: 'string',
        description: 'Git branch (optional)',
      },
    },
    required: ['testName', 'errorMessage', 'category', 'resolution', 'resolvedBy'],
  },
};

export const getKnowledgeStatsToolDefinition = {
  name: 'testops_get_knowledge_stats',
  description: `Get statistics about the knowledge base.

Shows:
- Total number of entries
- Resolved vs unresolved
- Breakdown by category
- Recent additions

Useful for understanding the health and growth of your knowledge base.`,
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

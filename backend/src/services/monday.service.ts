/**
 * Monday.com Integration Service
 *
 * Service for interacting with Monday.com Work OS API
 * API Reference: https://developer.monday.com/api-reference/docs
 */

import axios, { AxiosInstance } from 'axios';
import { validateUrlForSSRF } from '@/utils/ssrf-validator';
import {
  MondayConfig,
  MondayBoard,
  MondayItem,
  MondayUpdate,
  CreateMondayItemInput,
  UpdateMondayItemInput,
  CreateMondayUpdateInput,
  MondayTestFailureInput,
  MondayBoardsResponse,
  MondayItemResponse,
  MondayUpdateResponse,
} from '../types/monday';

export class MondayService {
  private client: AxiosInstance;
  private config: MondayConfig;

  constructor(config: MondayConfig) {
    this.config = {
      apiUrl: config.apiUrl || 'https://api.monday.com/v2',
      ...config,
    };

    validateUrlForSSRF(this.config.apiUrl!);

    this.client = axios.create({
      baseURL: this.config.apiUrl,
      headers: {
        'Authorization': this.config.apiToken,
        'Content-Type': 'application/json',
        'API-Version': '2023-10',
      },
    });
  }

  /**
   * Execute a GraphQL query against Monday.com API
   */
  private async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    try {
      const response = await this.client.post('', {
        query,
        variables,
      });

      if (response.data.errors) {
        throw new Error(`Monday.com API error: ${JSON.stringify(response.data.errors)}`);
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Monday.com API request failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get all boards accessible by the API token
   */
  async getBoards(): Promise<MondayBoard[]> {
    const query = `
      query {
        boards {
          id
          name
          description
          state
          board_kind
          workspace_id
        }
      }
    `;

    const response = await this.query<MondayBoardsResponse>(query);
    return response.boards;
  }

  /**
   * Get a specific board by ID
   */
  async getBoard(boardId: string): Promise<MondayBoard> {
    const query = `
      query ($boardId: [ID!]) {
        boards (ids: $boardId) {
          id
          name
          description
          state
          board_kind
          workspace_id
        }
      }
    `;

    const response = await this.query<MondayBoardsResponse>(query, { boardId: [boardId] });

    if (!response.boards || response.boards.length === 0) {
      throw new Error(`Board with ID ${boardId} not found`);
    }

    return response.boards[0];
  }

  /**
   * Create a new item on a Monday board
   */
  async createItem(input: CreateMondayItemInput): Promise<MondayItem> {
    const columnValuesJson = input.columnValues
      ? JSON.stringify(input.columnValues)
      : undefined;

    const query = `
      mutation ($boardId: ID!, $groupId: String, $itemName: String!, $columnValues: JSON) {
        create_item (
          board_id: $boardId,
          group_id: $groupId,
          item_name: $itemName,
          column_values: $columnValues
        ) {
          id
          name
          state
          column_values {
            id
            title
            type
            text
            value
          }
          group {
            id
            title
          }
          board {
            id
          }
          creator {
            id
            name
          }
          created_at
          updated_at
        }
      }
    `;

    const response = await this.query<MondayItemResponse>(query, {
      boardId: input.boardId,
      groupId: input.groupId,
      itemName: input.itemName,
      columnValues: columnValuesJson,
    });

    if (!response.create_item) {
      throw new Error('Failed to create Monday item');
    }

    return response.create_item;
  }

  /**
   * Update an existing item's column values
   */
  async updateItem(input: UpdateMondayItemInput): Promise<MondayItem> {
    const columnValuesJson = input.columnValues
      ? JSON.stringify(input.columnValues)
      : undefined;

    const query = `
      mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON) {
        change_multiple_column_values (
          board_id: $boardId,
          item_id: $itemId,
          column_values: $columnValues
        ) {
          id
          name
          column_values {
            id
            title
            type
            text
            value
          }
        }
      }
    `;

    const response = await this.query<{ change_multiple_column_values: MondayItem }>(query, {
      boardId: input.boardId,
      itemId: input.itemId,
      columnValues: columnValuesJson,
    });

    return response.change_multiple_column_values;
  }

  /**
   * Get items from a board
   */
  async getItems(boardId: string, limit: number = 25): Promise<MondayItem[]> {
    const query = `
      query ($boardId: [ID!], $limit: Int) {
        boards (ids: $boardId) {
          items_page (limit: $limit) {
            items {
              id
              name
              state
              column_values {
                id
                title
                type
                text
                value
              }
              group {
                id
                title
              }
              created_at
              updated_at
            }
          }
        }
      }
    `;

    const response = await this.query<{ boards: Array<{ items_page?: { items?: MondayItem[] } }> }>(query, {
      boardId: [boardId],
      limit,
    });

    return response.boards[0]?.items_page?.items || [];
  }

  /**
   * Create an update (comment) on an item
   */
  async createUpdate(input: CreateMondayUpdateInput): Promise<MondayUpdate> {
    const query = `
      mutation ($itemId: ID!, $body: String!) {
        create_update (item_id: $itemId, body: $body) {
          id
          body
          creator {
            id
            name
          }
          created_at
        }
      }
    `;

    const response = await this.query<MondayUpdateResponse>(query, {
      itemId: input.itemId,
      body: input.body,
    });

    if (!response.create_update) {
      throw new Error('Failed to create update');
    }

    return response.create_update;
  }

  /**
   * Create a Monday item from a test failure
   * Automatically formats the item with failure details
   */
  async createItemFromTestFailure(input: MondayTestFailureInput): Promise<MondayItem> {
    const itemName = `Test Failure: ${input.testName}`;

    // Format column values for test failure
    const columnValues: Record<string, unknown> = {
      // Assuming the board has these columns (customize based on your board structure)
      text: input.errorMessage.substring(0, 500), // Truncate to 500 chars
    };

    // Add link to test run if column exists
    if (input.testRunId) {
      columnValues.link = {
        url: `/test-runs/${input.testRunId}`,
        text: `Test Run #${input.testRunId}`,
      };
    }

    const item = await this.createItem({
      boardId: input.boardId,
      groupId: input.groupId || 'topics', // Default group
      itemName,
      columnValues,
    });

    // Add detailed failure information as an update/comment
    const updateBody = this.formatTestFailureUpdate(input);
    await this.createUpdate({
      itemId: item.id,
      body: updateBody,
    });

    return item;
  }

  /**
   * Format test failure details into a Monday update message
   */
  private formatTestFailureUpdate(failure: MondayTestFailureInput): string {
    let body = `**Test Failure Details**\n\n`;
    body += `**Test Name:** ${failure.testName}\n`;
    body += `**Test Run ID:** ${failure.testRunId}\n\n`;
    body += `**Error Message:**\n\`\`\`\n${failure.errorMessage}\n\`\`\`\n\n`;

    if (failure.stackTrace) {
      body += `**Stack Trace:**\n\`\`\`\n${failure.stackTrace.substring(0, 1000)}\n\`\`\`\n\n`;
    }

    body += `---\n`;
    body += `Created automatically by TestOps Copilot`;

    return body;
  }

  /**
   * Search for items by name
   */
  async searchItems(boardId: string, searchTerm: string): Promise<MondayItem[]> {
    const query = `
      query ($boardId: [ID!]) {
        boards (ids: $boardId) {
          items_page {
            items {
              id
              name
              state
              column_values {
                id
                title
                type
                text
                value
              }
            }
          }
        }
      }
    `;

    const response = await this.query<{ boards: Array<{ items_page?: { items?: MondayItem[] } }> }>(query, { boardId: [boardId] });
    const items = response.boards[0]?.items_page?.items || [];

    // Filter items by search term (Monday API doesn't have built-in search)
    return items.filter((item: MondayItem) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  /**
   * Test the Monday.com API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const query = `
        query {
          me {
            id
            name
            email
          }
        }
      `;

      await this.query(query);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
let mondayServiceInstance: MondayService | null = null;

/**
 * Get or create Monday service instance
 */
export function getMondayService(): MondayService {
  if (!mondayServiceInstance) {
    const apiToken = process.env.MONDAY_API_TOKEN;

    if (!apiToken) {
      throw new Error('MONDAY_API_TOKEN environment variable is not set');
    }

    mondayServiceInstance = new MondayService({
      apiToken,
      boardId: process.env.MONDAY_BOARD_ID,
      workspaceId: process.env.MONDAY_WORKSPACE_ID,
    });
  }

  return mondayServiceInstance;
}

/**
 * Reset Monday service instance (useful for testing)
 */
export function resetMondayService(): void {
  mondayServiceInstance = null;
}

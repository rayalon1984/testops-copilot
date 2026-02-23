/**
 * Vector Database - Weaviate Client
 *
 * Manages connection to Weaviate vector database for semantic search.
 */

import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client';
import { Embedding } from '../types';
import { getConfigManager } from '../config';
import { logger } from '@/utils/logger';

export interface VectorDBConfig {
  url: string;
  apiKey?: string;
  timeout?: number;
}

export interface VectorSearchResult {
  id: string;
  distance: number;
  properties: Record<string, unknown>;
}

export class WeaviateVectorClient {
  private client: WeaviateClient;
  private config: VectorDBConfig;
  private connected: boolean = false;

  constructor(config: VectorDBConfig) {
    this.config = config;
    this.client = this.createClient();
  }

  /**
   * Create Weaviate client
   */
  private createClient(): WeaviateClient {
    const clientConfig: Record<string, unknown> = {
      scheme: this.config.url.startsWith('https') ? 'https' : 'http',
      host: this.config.url.replace(/^https?:\/\//, ''),
    };

    if (this.config.apiKey) {
      clientConfig.apiKey = new ApiKey(this.config.apiKey);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return weaviate.client(clientConfig as any);
  }

  /**
   * Connect and verify connection
   */
  async connect(): Promise<void> {
    try {
      const meta = await this.client.misc.metaGetter().do();
      this.connected = true;
      logger.info(`[Weaviate] Connected to Weaviate ${meta.version}`);
    } catch (error) {
      this.connected = false;
      throw new Error(`Failed to connect to Weaviate: ${error}`);
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Create a class (collection) in Weaviate
   */
  async createClass(className: string, schema: Record<string, unknown>): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.client.schema.classCreator().withClass(schema as any).do();
      logger.info(`[Weaviate] Created class: ${className}`);
    } catch (error: unknown) {
      // Ignore if class already exists
      if (error instanceof Error && error.message?.includes('already exists')) {
        logger.info(`[Weaviate] Class already exists: ${className}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Delete a class
   */
  async deleteClass(className: string): Promise<void> {
    try {
      await this.client.schema.classDeleter().withClassName(className).do();
      logger.info(`[Weaviate] Deleted class: ${className}`);
    } catch (error) {
      logger.warn(`[Weaviate] Failed to delete class ${className}: ${error}`);
    }
  }

  /**
   * Check if a class exists
   */
  async classExists(className: string): Promise<boolean> {
    try {
      const schema = await this.client.schema.getter().do();
      return schema.classes?.some((c: Record<string, unknown>) => c.class === className) || false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Insert an object with vector embedding
   */
  async insert(
    className: string,
    properties: Record<string, unknown>,
    vector: Embedding,
    id?: string
  ): Promise<string> {
    try {
      const creator = this.client.data
        .creator()
        .withClassName(className)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .withProperties(properties as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .withVector(vector as any);

      if (id) {
        creator.withId(id);
      }

      const result = await creator.do();
      return result.id || '';
    } catch (error) {
      throw new Error(`Failed to insert into ${className}: ${error}`);
    }
  }

  /**
   * Batch insert objects
   */
  async batchInsert(
    className: string,
    objects: Array<{
      properties: Record<string, unknown>;
      vector: Embedding;
      id?: string;
    }>
  ): Promise<string[]> {
    try {
      let batcher = this.client.batch.objectsBatcher();

      for (const obj of objects) {
        const weaviateObj: Record<string, unknown> = {
          class: className,
          properties: obj.properties,
          vector: obj.vector,
        };

        if (obj.id) {
          weaviateObj.id = obj.id;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        batcher = batcher.withObject(weaviateObj as any);
      }

      const result = await batcher.do();
      return result.map((r: Record<string, unknown>) => r.id as string);
    } catch (error) {
      throw new Error(`Failed to batch insert into ${className}: ${error}`);
    }
  }

  /**
   * Search for similar vectors
   */
  async search(
    className: string,
    vector: Embedding,
    limit: number = 10,
    filters?: Record<string, unknown>
  ): Promise<VectorSearchResult[]> {
    try {
      let query = this.client.graphql
        .get()
        .withClassName(className)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .withNearVector({ vector: vector as any })
        .withLimit(limit)
        .withFields('_additional { id distance }');

      // Add filters if provided
      if (filters) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        query = query.withWhere(filters as any);
      }

      const result = await query.do();

      const objects = result.data?.Get?.[className] || [];
      return objects.map((obj: Record<string, unknown>) => {
        const additional = obj._additional as Record<string, unknown>;
        return {
          id: additional.id as string,
          distance: additional.distance as number,
          properties: { ...obj },
        };
      });
    } catch (error) {
      throw new Error(`Failed to search ${className}: ${error}`);
    }
  }

  /**
   * Get object by ID
   */
  async getById(className: string, id: string): Promise<Record<string, unknown> | null> {
    try {
      const result = await this.client.data
        .getterById()
        .withClassName(className)
        .withId(id)
        .do();

      return result.properties || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Update object
   */
  async update(
    className: string,
    id: string,
    properties: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.client.data
        .updater()
        .withClassName(className)
        .withId(id)
        .withProperties(properties)
        .do();
    } catch (error) {
      throw new Error(`Failed to update ${className}/${id}: ${error}`);
    }
  }

  /**
   * Delete object by ID
   */
  async delete(className: string, id: string): Promise<void> {
    try {
      await this.client.data
        .deleter()
        .withClassName(className)
        .withId(id)
        .do();
    } catch (error) {
      throw new Error(`Failed to delete ${className}/${id}: ${error}`);
    }
  }

  /**
   * Delete objects matching a filter
   */
  async deleteWhere(className: string, filters: Record<string, unknown>): Promise<number> {
    try {
      const result = await this.client.batch
        .objectsBatchDeleter()
        .withClassName(className)
        .withWhere(filters)
        .do();

      return result.results?.successful || 0;
    } catch (error) {
      throw new Error(`Failed to delete from ${className}: ${error}`);
    }
  }

  /**
   * Get statistics about a class
   */
  async getStats(className: string): Promise<{
    count: number;
    shards: number;
  }> {
    try {
      const result = await this.client.graphql
        .aggregate()
        .withClassName(className)
        .withFields('meta { count }')
        .do();

      const count = result.data?.Aggregate?.[className]?.[0]?.meta?.count || 0;

      return {
        count,
        shards: 1, // Default for single-node setup
      };
    } catch (error) {
      return { count: 0, shards: 0 };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.misc.liveChecker().do();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    this.connected = false;
    // Weaviate client doesn't need explicit close
  }
}

// Singleton instance
let vectorClient: WeaviateVectorClient | null = null;

export function getVectorClient(config?: VectorDBConfig): WeaviateVectorClient {
  if (!vectorClient) {
    const finalConfig = config || getConfigManager().getVectorDBConfig();
    vectorClient = new WeaviateVectorClient(finalConfig);
  }
  return vectorClient;
}

export function closeVectorClient(): void {
  if (vectorClient) {
    vectorClient.close();
    vectorClient = null;
  }
}

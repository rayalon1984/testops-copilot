/**
 * Vector Database - Semantic Search
 *
 * High-level search functions for finding similar test failures.
 */

import { WeaviateVectorClient } from './client';
import { TestFailure, SimilarFailure, Embedding } from '../types';

export interface SearchOptions {
  limit?: number;
  minSimilarity?: number;
  filters?: {
    pipeline?: string;
    branch?: string;
    category?: string;
    dateFrom?: Date;
    dateTo?: Date;
    resolved?: boolean;
  };
}

export class VectorSearch {
  private client: WeaviateVectorClient;

  constructor(client: WeaviateVectorClient) {
    this.client = client;
  }

  /**
   * Find similar test failures based on embedding
   */
  async findSimilarFailures(
    embedding: Embedding,
    options: SearchOptions = {}
  ): Promise<SimilarFailure[]> {
    const limit = options.limit || 10;
    const minSimilarity = options.minSimilarity || 0.7;

    // Build Weaviate filters
    const filters = this.buildFilters(options.filters);

    // Search for similar vectors
    const results = await this.client.search('TestFailure', embedding, limit, filters);

    // Convert to SimilarFailure objects
    const similarFailures: SimilarFailure[] = [];

    for (const result of results) {
      const similarity = 1 - result.distance; // Convert distance to similarity

      if (similarity < minSimilarity) {
        continue; // Skip low similarity results
      }

      const failure: TestFailure = {
        id: result.id,
        testId: result.properties.testId,
        testName: result.properties.testName,
        errorMessage: result.properties.errorMessage,
        stackTrace: result.properties.stackTrace,
        logSnippet: result.properties.logSnippet,
        pipeline: result.properties.pipeline,
        branch: result.properties.branch,
        commitHash: result.properties.commitHash,
        timestamp: new Date(result.properties.timestamp),
        category: result.properties.category,
        categoryConfidence: result.properties.categoryConfidence,
        summary: result.properties.summary,
        embedding: {
          model: result.properties.embeddingModel,
          vector: [], // Don't return full embedding vector
          dimensions: 0,
        },
      };

      similarFailures.push({
        failure,
        similarity,
        explanation: this.generateExplanation(similarity, failure),
        resolution: result.properties.resolution,
        resolvedAt: result.properties.resolvedAt ? new Date(result.properties.resolvedAt) : undefined,
        resolvedBy: result.properties.resolvedBy,
        ticketUrl: result.properties.ticketUrl,
      });
    }

    return similarFailures;
  }

  /**
   * Store a test failure with embedding
   */
  async storeFailure(failure: TestFailure): Promise<string> {
    if (!failure.embedding) {
      throw new Error('Failure must have an embedding to store');
    }

    const properties = {
      testId: failure.testId,
      testName: failure.testName,
      errorMessage: failure.errorMessage,
      stackTrace: failure.stackTrace || '',
      logSnippet: failure.logSnippet || '',
      pipeline: failure.pipeline,
      branch: failure.branch,
      commitHash: failure.commitHash,
      timestamp: failure.timestamp.toISOString(),
      category: failure.category || '',
      categoryConfidence: failure.categoryConfidence || 0,
      summary: failure.summary || '',
      resolution: '',
      resolvedAt: null,
      resolvedBy: null,
      ticketUrl: null,
      embeddingModel: failure.embedding.model,
    };

    return await this.client.insert('TestFailure', properties, failure.embedding, failure.id);
  }

  /**
   * Update failure with resolution
   */
  async markAsResolved(
    failureId: string,
    resolution: string,
    resolvedBy: string,
    ticketUrl?: string
  ): Promise<void> {
    await this.client.update('TestFailure', failureId, {
      resolution,
      resolvedAt: new Date().toISOString(),
      resolvedBy,
      ticketUrl: ticketUrl || null,
    });
  }

  /**
   * Delete old failures (for cleanup)
   */
  async deleteOldFailures(daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const filters = {
      path: ['timestamp'],
      operator: 'LessThan',
      valueDate: cutoffDate.toISOString(),
    };

    return await this.client.deleteWhere('TestFailure', filters);
  }

  /**
   * Get statistics about stored failures
   */
  async getStats(): Promise<{
    total: number;
    byCategory: Record<string, number>;
    resolved: number;
    unresolved: number;
  }> {
    const stats = await this.client.getStats('TestFailure');

    // TODO: Implement aggregation queries for detailed stats
    // For now, return basic stats
    return {
      total: stats.count,
      byCategory: {},
      resolved: 0,
      unresolved: stats.count,
    };
  }

  /**
   * Build Weaviate filters from search options
   */
  private buildFilters(filters?: SearchOptions['filters']): any {
    if (!filters) {
      return undefined;
    }

    const conditions: any[] = [];

    if (filters.pipeline) {
      conditions.push({
        path: ['pipeline'],
        operator: 'Equal',
        valueString: filters.pipeline,
      });
    }

    if (filters.branch) {
      conditions.push({
        path: ['branch'],
        operator: 'Equal',
        valueString: filters.branch,
      });
    }

    if (filters.category) {
      conditions.push({
        path: ['category'],
        operator: 'Equal',
        valueString: filters.category,
      });
    }

    if (filters.dateFrom) {
      conditions.push({
        path: ['timestamp'],
        operator: 'GreaterThanEqual',
        valueDate: filters.dateFrom.toISOString(),
      });
    }

    if (filters.dateTo) {
      conditions.push({
        path: ['timestamp'],
        operator: 'LessThanEqual',
        valueDate: filters.dateTo.toISOString(),
      });
    }

    if (filters.resolved !== undefined) {
      if (filters.resolved) {
        conditions.push({
          path: ['resolvedAt'],
          operator: 'IsNull',
          valueBoolean: false,
        });
      } else {
        conditions.push({
          path: ['resolvedAt'],
          operator: 'IsNull',
          valueBoolean: true,
        });
      }
    }

    if (conditions.length === 0) {
      return undefined;
    }

    if (conditions.length === 1) {
      return conditions[0];
    }

    return {
      operator: 'And',
      operands: conditions,
    };
  }

  /**
   * Generate explanation for why failures are similar
   */
  private generateExplanation(similarity: number, failure: TestFailure): string {
    const percentage = Math.round(similarity * 100);

    if (similarity >= 0.95) {
      return `Very similar failure (${percentage}% match). Same error pattern and context.`;
    } else if (similarity >= 0.85) {
      return `Highly similar failure (${percentage}% match). Likely the same root cause.`;
    } else if (similarity >= 0.75) {
      return `Similar failure (${percentage}% match). Related issue in ${failure.testName}.`;
    } else {
      return `Somewhat similar failure (${percentage}% match). May share common characteristics.`;
    }
  }
}

// Export singleton
let vectorSearch: VectorSearch | null = null;

export function getVectorSearch(client: WeaviateVectorClient): VectorSearch {
  if (!vectorSearch) {
    vectorSearch = new VectorSearch(client);
  }
  return vectorSearch;
}

/**
 * AI Features - RCA (Root Cause Analysis) Matching
 *
 * Uses semantic embeddings to find similar test failures and suggest
 * root causes based on historical data.
 */

import { BaseProvider } from '../providers/base.provider';
import { WeaviateVectorClient } from '../vector/client';
import { VectorSearch, SearchOptions } from '../vector/search';
import { TestFailure, SimilarFailure, Embedding } from '../types';

export interface RCAMatchingOptions {
  /**
   * Minimum similarity threshold (0-1)
   * Default: 0.75
   */
  minSimilarity?: number;

  /**
   * Maximum number of similar failures to return
   * Default: 5
   */
  limit?: number;

  /**
   * Whether to include only resolved failures
   * Default: true (only show failures with known resolutions)
   */
  onlyResolved?: boolean;

  /**
   * Filter by pipeline
   */
  pipeline?: string;

  /**
   * Filter by branch
   */
  branch?: string;

  /**
   * How far back to search (in days)
   * Default: 90 days
   */
  lookbackDays?: number;
}

export class RCAMatchingService {
  private provider: BaseProvider;
  private vectorClient: WeaviateVectorClient;
  private vectorSearch: VectorSearch;

  constructor(provider: BaseProvider, vectorClient: WeaviateVectorClient) {
    this.provider = provider;
    this.vectorClient = vectorClient;
    this.vectorSearch = new VectorSearch(vectorClient);
  }

  /**
   * Find similar failures for a given test failure
   *
   * This is the main RCA matching function. It:
   * 1. Generates an embedding for the failure
   * 2. Searches for similar failures in the vector database
   * 3. Uses AI to analyze and explain the matches
   * 4. Returns ranked similar failures with explanations
   */
  async findSimilarFailures(
    failure: TestFailure,
    options: RCAMatchingOptions = {}
  ): Promise<SimilarFailure[]> {
    // Step 1: Generate embedding for this failure
    const embedding = await this.generateFailureEmbedding(failure);

    // Step 2: Search for similar failures
    const searchOptions: SearchOptions = {
      limit: options.limit || 5,
      minSimilarity: options.minSimilarity || 0.75,
      filters: {
        pipeline: options.pipeline,
        branch: options.branch,
        resolved: options.onlyResolved ?? true,
      },
    };

    // Add date filter for lookback
    if (options.lookbackDays) {
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - options.lookbackDays);
      searchOptions.filters!.dateFrom = dateFrom;
    }

    const similarFailures = await this.vectorSearch.findSimilarFailures(
      embedding,
      searchOptions
    );

    // Step 3: Enhance results with AI analysis if we found matches
    if (similarFailures.length > 0) {
      return await this.enhanceWithAIAnalysis(failure, similarFailures);
    }

    return similarFailures;
  }

  /**
   * Store a failure in the vector database for future matching
   */
  async storeFailure(failure: TestFailure): Promise<string> {
    // Generate embedding if not present
    if (!failure.embedding) {
      failure.embedding = await this.generateFailureEmbedding(failure);
    }

    // Store in vector database
    return await this.vectorSearch.storeFailure(failure);
  }

  /**
   * Mark a failure as resolved with the solution
   * This makes it available for future RCA matching
   */
  async markAsResolved(
    failureId: string,
    resolution: string,
    resolvedBy: string,
    ticketUrl?: string
  ): Promise<void> {
    await this.vectorSearch.markAsResolved(failureId, resolution, resolvedBy, ticketUrl);
  }

  /**
   * Generate embedding for a test failure
   *
   * Combines error message, stack trace, and log snippet into a single
   * text representation and generates an embedding.
   */
  private async generateFailureEmbedding(failure: TestFailure): Promise<Embedding> {
    // Create a text representation of the failure
    const text = this.failureToText(failure);

    // Generate embedding using the provider
    const vector = await this.provider.embed(text);

    return {
      model: this.getEmbeddingModel(),
      vector: vector,
      dimensions: vector.length,
    };
  }

  /**
   * Convert failure to text for embedding
   */
  private failureToText(failure: TestFailure): string {
    const parts: string[] = [];

    // Test name provides context
    parts.push(`Test: ${failure.testName}`);

    // Error message is the primary signal
    parts.push(`Error: ${failure.errorMessage}`);

    // Stack trace helps identify location
    if (failure.stackTrace) {
      // Take first few lines of stack trace (most relevant)
      const stackLines = failure.stackTrace.split('\n').slice(0, 5);
      parts.push(`Stack:\n${stackLines.join('\n')}`);
    }

    // Log snippet provides additional context
    if (failure.logSnippet) {
      // Limit log snippet size
      const logPreview = failure.logSnippet.substring(0, 500);
      parts.push(`Logs: ${logPreview}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Enhance similar failures with AI analysis
   *
   * Uses the LLM to analyze the matches and provide better explanations
   * of why they're similar and what the root cause might be.
   */
  private async enhanceWithAIAnalysis(
    currentFailure: TestFailure,
    similarFailures: SimilarFailure[]
  ): Promise<SimilarFailure[]> {
    try {
      // Build prompt for AI analysis
      const prompt = this.buildAnalysisPrompt(currentFailure, similarFailures);

      // Get AI analysis
      const response = await this.provider.chat(
        [
          {
            role: 'system',
            content: 'You are an expert at analyzing test failures and identifying root causes. Analyze the provided failures and explain their similarities.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        {
          maxTokens: 1000,
          temperature: 0.3, // Lower temperature for more focused analysis
        }
      );

      // Parse AI response and enhance explanations
      // For now, add the AI analysis as a note to the first failure
      if (similarFailures.length > 0) {
        similarFailures[0].explanation = `${similarFailures[0].explanation}\n\nAI Analysis: ${response.content}`;
      }

      return similarFailures;
    } catch (error) {
      console.error('Failed to enhance with AI analysis:', error);
      // Return original results if AI enhancement fails
      return similarFailures;
    }
  }

  /**
   * Build prompt for AI analysis
   */
  private buildAnalysisPrompt(
    currentFailure: TestFailure,
    similarFailures: SimilarFailure[]
  ): string {
    let prompt = `Analyze this test failure and explain why it's similar to the historical failures below.\n\n`;

    prompt += `## Current Failure\n`;
    prompt += `Test: ${currentFailure.testName}\n`;
    prompt += `Error: ${currentFailure.errorMessage}\n`;
    if (currentFailure.stackTrace) {
      prompt += `Stack Trace:\n${currentFailure.stackTrace.substring(0, 500)}\n`;
    }

    prompt += `\n## Similar Historical Failures\n`;
    for (let i = 0; i < Math.min(3, similarFailures.length); i++) {
      const similar = similarFailures[i];
      prompt += `\n### Match ${i + 1} (${Math.round(similar.similarity * 100)}% similar)\n`;
      prompt += `Test: ${similar.failure.testName}\n`;
      prompt += `Error: ${similar.failure.errorMessage}\n`;
      if (similar.resolution) {
        prompt += `Resolution: ${similar.resolution}\n`;
      }
    }

    prompt += `\nProvide a concise analysis (2-3 sentences) of:\n`;
    prompt += `1. Why these failures are similar\n`;
    prompt += `2. What the likely root cause is\n`;
    prompt += `3. Suggested next steps for resolution\n`;

    return prompt;
  }

  /**
   * Get the embedding model name based on provider
   */
  private getEmbeddingModel(): string {
    const provider = this.provider.getName();

    switch (provider) {
      case 'openai':
        return 'text-embedding-3-small';
      case 'anthropic':
        return 'voyage-2'; // Voyage AI recommended by Anthropic
      case 'google':
        return 'embedding-001';
      case 'azure':
        return 'text-embedding-ada-002';
      default:
        return 'unknown';
    }
  }

  /**
   * Get statistics about RCA matching
   */
  async getStats() {
    return await this.vectorSearch.getStats();
  }

  /**
   * Clean up old failures (maintenance)
   */
  async cleanup(daysToKeep: number = 90): Promise<number> {
    return await this.vectorSearch.deleteOldFailures(daysToKeep);
  }
}

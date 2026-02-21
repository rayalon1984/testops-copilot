/**
 * Vector Database - Weaviate Schema Definitions
 *
 * Defines the schema for storing test failures and their embeddings in Weaviate.
 */

import { WeaviateVectorClient } from './client';

/**
 * Schema for TestFailure class in Weaviate
 *
 * This class stores test failure information along with embeddings for semantic search.
 */
export const TestFailureSchema = {
  class: 'TestFailure',
  description: 'Test failure with semantic embedding for RCA matching',
  vectorizer: 'none', // We provide our own vectors
  properties: [
    {
      name: 'testId',
      dataType: ['string'],
      description: 'Unique identifier for the test',
      indexInverted: true,
    },
    {
      name: 'testName',
      dataType: ['string'],
      description: 'Name of the test',
      indexInverted: true,
    },
    {
      name: 'errorMessage',
      dataType: ['text'],
      description: 'Error message from the test failure',
      indexInverted: true,
    },
    {
      name: 'stackTrace',
      dataType: ['text'],
      description: 'Stack trace of the failure',
      indexInverted: false,
    },
    {
      name: 'logSnippet',
      dataType: ['text'],
      description: 'Relevant log snippet',
      indexInverted: false,
    },
    {
      name: 'pipeline',
      dataType: ['string'],
      description: 'Pipeline name where failure occurred',
      indexInverted: true,
    },
    {
      name: 'branch',
      dataType: ['string'],
      description: 'Git branch',
      indexInverted: true,
    },
    {
      name: 'commitHash',
      dataType: ['string'],
      description: 'Git commit hash',
      indexInverted: true,
    },
    {
      name: 'timestamp',
      dataType: ['date'],
      description: 'When the failure occurred',
      indexInverted: true,
    },
    {
      name: 'category',
      dataType: ['string'],
      description: 'Failure category (bug_critical, bug_minor, environment, flaky, etc.)',
      indexInverted: true,
    },
    {
      name: 'categoryConfidence',
      dataType: ['number'],
      description: 'Confidence score for the category (0-1)',
      indexInverted: false,
    },
    {
      name: 'summary',
      dataType: ['text'],
      description: 'AI-generated summary of the failure',
      indexInverted: false,
    },
    {
      name: 'resolution',
      dataType: ['text'],
      description: 'How the failure was resolved',
      indexInverted: false,
    },
    {
      name: 'resolvedAt',
      dataType: ['date'],
      description: 'When the failure was resolved',
      indexInverted: true,
    },
    {
      name: 'resolvedBy',
      dataType: ['string'],
      description: 'Who resolved the failure',
      indexInverted: true,
    },
    {
      name: 'ticketUrl',
      dataType: ['string'],
      description: 'URL to related ticket (Jira, Monday, etc.)',
      indexInverted: false,
    },
    {
      name: 'embeddingModel',
      dataType: ['string'],
      description: 'Which model generated the embedding',
      indexInverted: true,
    },
  ],
};

/**
 * Schema for LogSummary class in Weaviate
 *
 * Stores AI-generated log summaries with embeddings.
 */
export const LogSummarySchema = {
  class: 'LogSummary',
  description: 'AI-generated log summaries with semantic embeddings',
  vectorizer: 'none',
  properties: [
    {
      name: 'failureId',
      dataType: ['string'],
      description: 'Reference to the test failure',
      indexInverted: true,
    },
    {
      name: 'logHash',
      dataType: ['string'],
      description: 'Hash of the log content for deduplication',
      indexInverted: true,
    },
    {
      name: 'summary',
      dataType: ['text'],
      description: 'AI-generated summary',
      indexInverted: false,
    },
    {
      name: 'rootCause',
      dataType: ['text'],
      description: 'Identified root cause',
      indexInverted: false,
    },
    {
      name: 'suggestedFix',
      dataType: ['text'],
      description: 'AI-suggested fix',
      indexInverted: false,
    },
    {
      name: 'confidence',
      dataType: ['number'],
      description: 'Confidence score (0-1)',
      indexInverted: false,
    },
    {
      name: 'createdAt',
      dataType: ['date'],
      description: 'When the summary was created',
      indexInverted: true,
    },
    {
      name: 'model',
      dataType: ['string'],
      description: 'AI model used for generation',
      indexInverted: true,
    },
  ],
};

/**
 * Get all schema definitions
 */
export function getAllSchemas() {
  return [TestFailureSchema, LogSummarySchema];
}

/**
 * Initialize all schemas in Weaviate
 */
export async function initializeSchemas(client: WeaviateVectorClient): Promise<void> {
  const schemas = getAllSchemas();

  for (const schema of schemas) {
    try {
      await client.createClass(schema.class, schema);
    } catch (error) {
      console.error(`Failed to create schema for ${schema.class}:`, error);
      throw error;
    }
  }
}

/**
 * Delete all schemas from Weaviate (useful for testing)
 */
export async function deleteAllSchemas(client: WeaviateVectorClient): Promise<void> {
  const schemas = getAllSchemas();

  for (const schema of schemas) {
    try {
      await client.deleteClass(schema.class);
    } catch (error) {
      console.warn(`Failed to delete schema ${schema.class}:`, error);
    }
  }
}

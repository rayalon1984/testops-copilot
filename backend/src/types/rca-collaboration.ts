/**
 * Types for Collaborative RCA (revisions, comments, activity)
 */

export interface RCARevisionDTO {
  id: string;
  version: number;
  rootCause: string | null;
  solution: string | null;
  prevention: string | null;
  tags: string | null;
  editedBy: string;
  editSummary: string | null;
  createdAt: string;
}

export interface FailureCommentDTO {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityFeedItem {
  type: 'revision' | 'comment' | 'status_change';
  timestamp: string;
  userId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentRCAWithVersionInput {
  rootCause: string;
  detailedAnalysis?: string;
  solution?: string;
  preventionSteps?: string;
  workaround?: string;
  jiraIssueKey?: string;
  prUrl?: string;
  tags?: string[];
  expectedVersion?: number;
  editSummary?: string;
}

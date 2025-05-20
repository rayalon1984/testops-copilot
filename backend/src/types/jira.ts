import { z } from 'zod';

export enum JiraIssueType {
  BUG = 'BUG',
  TASK = 'TASK',
  STORY = 'STORY',
  EPIC = 'EPIC'
}

export enum JiraIssueStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  CUSTOM = 'CUSTOM'
}

export const createIssueSchema = z.object({
  summary: z.string(),
  description: z.string(),
  type: z.nativeEnum(JiraIssueType),
  labels: z.array(z.string()).optional(),
  testRunId: z.string().uuid().optional(),
  pipelineId: z.string().uuid().optional(),
});

export const updateIssueSchema = z.object({
  summary: z.string().optional(),
  description: z.string().optional(),
  status: z.nativeEnum(JiraIssueStatus).optional(),
  labels: z.array(z.string()).optional(),
});

export const linkTestRunSchema = z.object({
  testRunId: z.string().uuid(),
});

export type CreateIssueDTO = z.infer<typeof createIssueSchema>;
export type UpdateIssueDTO = z.infer<typeof updateIssueSchema>;
export type LinkTestRunDTO = z.infer<typeof linkTestRunSchema>;

export interface JiraIssueResponse {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: string;
    status: {
      name: string;
    };
    issuetype: {
      name: string;
    };
    labels: string[];
    [key: string]: any;
  };
}
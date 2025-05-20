import JiraClient from 'jira-client';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import { config } from '@/config';
import {
  JiraIssueType,
  JiraIssueStatus,
  CreateIssueDTO,
  UpdateIssueDTO,
  JiraIssueResponse
} from '@/types/jira';

const prisma = new PrismaClient();

export class JiraService {
  private client: JiraClient;
  private projectKey: string;

  constructor() {
    this.client = new JiraClient({
      protocol: 'https',
      host: new URL(config.jira.baseUrl).hostname,
      apiVersion: '2',
      strictSSL: true,
      bearer: config.jira.apiToken,
    });
    this.projectKey = config.jira.projectKey;
  }

  async createIssue(data: CreateIssueDTO): Promise<string> {
    try {
      // Create issue in Jira
      const issue = await this.client.addNewIssue({
        fields: {
          project: { key: this.projectKey },
          summary: data.summary,
          description: data.description,
          issuetype: { name: data.type },
          labels: data.labels || [],
        },
      });

      // Store issue in our database
      await prisma.jiraIssue.create({
        data: {
          issueKey: issue.key,
          issueType: data.type,
          status: JiraIssueStatus.TODO,
          summary: data.summary,
          description: data.description,
          labels: data.labels || [],
          ...(data.testRunId && { testRunId: data.testRunId }),
          ...(data.pipelineId && { pipelineId: data.pipelineId }),
        },
      });

      logger.info(`Created Jira issue: ${issue.key}`);
      return issue.key;
    } catch (error) {
      logger.error('Failed to create Jira issue:', error);
      throw new Error('Failed to create Jira issue');
    }
  }

  async updateIssue(issueKey: string, data: UpdateIssueDTO): Promise<void> {
    try {
      // Update issue in Jira
      await this.client.updateIssue(issueKey, {
        fields: {
          ...(data.summary && { summary: data.summary }),
          ...(data.description && { description: data.description }),
          ...(data.labels && { labels: data.labels }),
        },
      });

      // If status is provided, transition the issue
      if (data.status) {
        await this.transitionIssue(issueKey, data.status);
      }

      // Update issue in our database
      await prisma.jiraIssue.update({
        where: { issueKey },
        data: {
          ...(data.summary && { summary: data.summary }),
          ...(data.description && { description: data.description }),
          ...(data.status && { status: data.status }),
          ...(data.labels && { labels: data.labels }),
        },
      });

      logger.info(`Updated Jira issue: ${issueKey}`);
    } catch (error) {
      logger.error(`Failed to update Jira issue ${issueKey}:`, error);
      throw new Error('Failed to update Jira issue');
    }
  }

  async getIssue(issueKey: string): Promise<JiraIssueResponse> {
    try {
      const issue = await this.client.findIssue(issueKey);
      return {
        id: issue.id,
        key: issue.key,
        fields: {
          summary: issue.fields.summary,
          description: issue.fields.description,
          status: {
            name: issue.fields.status.name
          },
          issuetype: {
            name: issue.fields.issuetype.name
          },
          labels: issue.fields.labels || [],
          ...issue.fields
        }
      };
    } catch (error) {
      logger.error(`Failed to get Jira issue ${issueKey}:`, error);
      throw new Error('Failed to get Jira issue');
    }
  }

  async linkTestRun(issueKey: string, testRunId: string): Promise<void> {
    try {
      // Verify issue exists
      const issue = await prisma.jiraIssue.findUnique({
        where: { issueKey },
      });

      if (!issue) {
        throw new Error('Issue not found');
      }

      // Update issue with test run link
      await prisma.jiraIssue.update({
        where: { issueKey },
        data: { testRunId },
      });

      // Add comment to Jira issue
      await this.client.addComment(issueKey, {
        body: `Linked to test run: ${testRunId}`,
      });

      logger.info(`Linked test run ${testRunId} to Jira issue ${issueKey}`);
    } catch (error) {
      logger.error(`Failed to link test run ${testRunId} to Jira issue ${issueKey}:`, error);
      throw new Error('Failed to link test run to Jira issue');
    }
  }

  private async transitionIssue(issueKey: string, status: JiraIssueStatus): Promise<void> {
    try {
      // Get available transitions
      const transitions = await this.client.listTransitions(issueKey);
      
      // Map our status to Jira transition
      const transitionMap: Record<JiraIssueStatus, string> = {
        [JiraIssueStatus.TODO]: 'To Do',
        [JiraIssueStatus.IN_PROGRESS]: 'In Progress',
        [JiraIssueStatus.DONE]: 'Done',
        [JiraIssueStatus.CUSTOM]: 'Custom', // Handle custom transitions separately
      };

      const targetTransition = transitions.transitions.find(
        t => t.name === transitionMap[status]
      );

      if (!targetTransition) {
        throw new Error(`No transition found for status: ${status}`);
      }

      // Perform the transition
      await this.client.transitionIssue(issueKey, {
        transition: { id: targetTransition.id },
      });

      logger.info(`Transitioned Jira issue ${issueKey} to ${status}`);
    } catch (error) {
      logger.error(`Failed to transition Jira issue ${issueKey}:`, error);
      throw new Error('Failed to transition Jira issue');
    }
  }
}

export const jiraService = new JiraService();
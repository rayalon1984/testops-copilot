import JiraClient from 'jira-client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';
import { config } from '@/config';
import {
  JiraIssueType,
  JiraIssueStatus,
  CreateIssueDTO,
  UpdateIssueDTO,
  JiraIssueResponse
} from '@/types/jira';

export class JiraService {
  private client: JiraClient | null = null;
  private projectKey: string = '';
  private enabled: boolean = false;

  constructor() {
    if (!config.jira) {
      logger.warn('Jira integration is not configured. Jira features will be disabled.');
      this.enabled = false;
      return;
    }

    try {
      this.client = new JiraClient({
        protocol: 'https',
        host: new URL(config.jira.baseUrl).hostname,
        apiVersion: '2',
        strictSSL: true,
        bearer: config.jira.apiToken,
      });
      this.projectKey = config.jira.projectKey;
      this.enabled = true;
      logger.info('Jira integration initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Jira client:', error);
      this.enabled = false;
    }
  }

  private checkEnabled() {
    if (!this.enabled || !this.client) {
      throw new Error('Jira integration is not enabled or configured');
    }
  }

  async createIssue(data: CreateIssueDTO): Promise<string> {
    this.checkEnabled();

    try {
      // Create issue in Jira
      const issue = await this.client!.addNewIssue({
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
          jiraKey: issue.key,
          jiraId: issue.id, // Ensure ID is saved if required/available
          projectKey: this.projectKey, // Add required projectKey
          issueType: data.type,
          status: JiraIssueStatus.TODO,
          summary: data.summary,
          description: data.description,
          // labels: data.labels?.join(',') || null, // Not in prod schema? Schema says labels string? No, prod schema doesn't have labels! Check Prod Schema (step 1521)
          // Prod Schema: jiraKey, jiraId, projectKey, summary, description, issueType, status, priority, assignee, reporter, testRunId, failureArchiveId, metadata
          // No labels column in Prod Schema for JiraIssue. It's in FailureArchive? Or removed?
          // I will remove labels from data object as it's not in Prod Schema.
          ...(data.testRunId && { testRunId: data.testRunId }),
        },
      });

      logger.info(`Created Jira issue: ${issue.key}`);
      return issue.key;
    } catch (error) {
      logger.error('Failed to create Jira issue:', error);
      throw new Error('Failed to create Jira issue');
    }
  }

  async updateIssue(jiraKey: string, data: UpdateIssueDTO): Promise<void> {
    this.checkEnabled();

    try {
      // Update issue in Jira
      await this.client!.updateIssue(jiraKey, {
        fields: {
          ...(data.summary && { summary: data.summary }),
          ...(data.description && { description: data.description }),
          ...(data.labels && { labels: data.labels }),
        },
      });

      // If status is provided, transition the issue
      if (data.status) {
        await this.transitionIssue(jiraKey, data.status);
      }

      // Update issue in our database
      await prisma.jiraIssue.update({
        where: { jiraKey },
        data: {
          ...(data.summary && { summary: data.summary }),
          ...(data.description && { description: data.description }),
          ...(data.status && { status: data.status }),
          // labels removed
        },
      });

      logger.info(`Updated Jira issue: ${jiraKey}`);
    } catch (error) {
      logger.error(`Failed to update Jira issue ${jiraKey}:`, error);
      throw new Error('Failed to update Jira issue');
    }
  }

  async getIssue(jiraKey: string): Promise<JiraIssueResponse> {
    this.checkEnabled();

    try {
      const issue = await this.client!.findIssue(jiraKey);
      return {
        id: issue.id,
        key: issue.key,
        fields: {
          summary: issue.fields.summary ?? '',
          description: issue.fields.description ?? '',
          status: {
            name: issue.fields.status.name
          },
          issuetype: {
            name: issue.fields.issuetype?.name ?? 'Unknown'
          },
          labels: issue.fields.labels || [],
          ...issue.fields
        }
      };
    } catch (error) {
      logger.error(`Failed to get Jira issue ${jiraKey}:`, error);
      throw new Error('Failed to get Jira issue');
    }
  }

  async linkTestRun(jiraKey: string, testRunId: string): Promise<void> {
    try {
      // Verify issue exists
      const issue = await prisma.jiraIssue.findUnique({
        where: { jiraKey },
      });

      if (!issue) {
        throw new Error('Issue not found');
      }

      // Update issue with test run link
      await prisma.jiraIssue.update({
        where: { jiraKey },
        data: { testRunId },
      });

      // Add comment to Jira issue
      await this.client!.addComment(jiraKey, {
        body: `Linked to test run: ${testRunId}`,
      });

      logger.info(`Linked test run ${testRunId} to Jira issue ${jiraKey}`);
    } catch (error) {
      logger.error(`Failed to link test run ${testRunId} to Jira issue ${jiraKey}:`, error);
      throw new Error('Failed to link test run to Jira issue');
    }
  }

  private async transitionIssue(issueKey: string, status: JiraIssueStatus): Promise<void> {
    this.checkEnabled();

    try {
      // Get available transitions
      const transitions = await this.client!.listTransitions(issueKey);

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
      await this.client!.transitionIssue(issueKey, {
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
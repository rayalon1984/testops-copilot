import JiraClient from 'jira-client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';
import { config } from '@/config';
import {
  JiraIssueStatus,
  CreateIssueDTO,
  UpdateIssueDTO,
  JiraIssueResponse
} from '@/types/jira';
import { withResilience, circuitBreakers } from '@/lib/resilience';

const JIRA_RESILIENCE = {
  circuitBreaker: circuitBreakers.jira,
  retry: { maxRetries: 2, baseDelayMs: 1000 },
  timeoutMs: 10_000,
  label: 'jira',
};

export class JiraService {
  private client: JiraClient | null = null;
  private projectKey: string = '';
  private enabled: boolean = false;
  private mockMode: boolean = false;

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
        ...(config.jira.email
          ? { basic_auth: { email: config.jira.email, api_token: config.jira.apiToken } }
          : { bearer: config.jira.apiToken }),
      });
      this.projectKey = config.jira.projectKey;
      this.enabled = true;

      if (config.jira.apiToken === 'mock-token') {
        this.mockMode = true;
        logger.info('Jira integration initialized in MOCK MODE');
      } else {
        logger.info('Jira integration initialized successfully');
      }
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
      let issue: { key: string; id: string };

      if (this.mockMode) {
        logger.info('[MOCK] Creating Jira Issue:', data);
        issue = { key: `MOCK-${Date.now()}`, id: `mock-id-${Date.now()}` };
      } else {
        // Create issue in Jira
        issue = await withResilience(
          () => this.client!.addNewIssue({
            fields: {
              project: { key: this.projectKey },
              summary: data.summary,
              description: data.description,
              issuetype: { name: data.type },
              labels: data.labels || [],
            },
          }),
          JIRA_RESILIENCE,
        );
      }

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
      await withResilience(
        () => this.client!.updateIssue(jiraKey, {
          fields: {
            ...(data.summary && { summary: data.summary }),
            ...(data.description && { description: data.description }),
            ...(data.labels && { labels: data.labels }),
          },
        }),
        JIRA_RESILIENCE,
      );

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
      const issue = await withResilience(
        () => this.client!.findIssue(jiraKey),
        JIRA_RESILIENCE,
      );
      return {
        id: issue.id,
        key: issue.key,
        fields: {
          summary: issue.fields.summary ?? '',
          description: issue.fields.description ?? '',
          status: {
            name: (issue.fields.status as { name?: string })?.name ?? 'Unknown'
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
      await withResilience(
        () => this.client!.addComment(jiraKey, { body: `Linked to test run: ${testRunId}` }),
        JIRA_RESILIENCE,
      );

      logger.info(`Linked test run ${testRunId} to Jira issue ${jiraKey}`);
    } catch (error) {
      logger.error(`Failed to link test run ${testRunId} to Jira issue ${jiraKey}:`, error);
      throw new Error('Failed to link test run to Jira issue');
    }
  }

  /**
   * Search Jira for issues similar to a given test failure.
   * Uses JQL text search on summary and description fields.
   */
  async searchSimilarIssues(
    errorMessage: string,
    testName?: string,
    options: { maxResults?: number; projectKey?: string; statusFilter?: string[] } = {}
  ): Promise<JiraIssueResponse[]> {
    this.checkEnabled();

    const maxResults = options.maxResults || 10;
    const project = options.projectKey || this.projectKey;

    try {
      // Extract key terms from the error message for JQL text search
      const searchTerms = this.extractSearchTerms(errorMessage);
      if (searchTerms.length === 0 && !testName) {
        return [];
      }

      // Build JQL query: search summary and description for matching terms
      const textClauses: string[] = [];
      if (searchTerms.length > 0) {
        const termString = searchTerms.join(' ');
        textClauses.push(`text ~ "${this.escapeJql(termString)}"`);
      }
      if (testName) {
        textClauses.push(`summary ~ "${this.escapeJql(testName)}"`);
      }

      let jql = `project = ${project} AND (${textClauses.join(' OR ')})`;

      // Optionally filter by status (e.g., only open issues)
      if (options.statusFilter && options.statusFilter.length > 0) {
        const statuses = options.statusFilter.map(s => `"${s}"`).join(', ');
        jql += ` AND status IN (${statuses})`;
      }

      jql += ' ORDER BY updated DESC';

      const result = await withResilience(
        () => this.client!.searchJira(jql, {
          maxResults,
          fields: ['summary', 'description', 'status', 'issuetype', 'labels', 'updated', 'created', 'assignee', 'priority'],
        }),
        JIRA_RESILIENCE,
      );

      const issues: JiraIssueResponse[] = (result.issues || []).map((issue: { id: string; key: string; fields: Record<string, unknown> & { summary?: string; description?: string; status?: { name?: string }; issuetype?: { name?: string }; labels?: string[]; priority?: { name?: string }; assignee?: { displayName?: string } } }) => ({
        id: issue.id,
        key: issue.key,
        fields: {
          summary: issue.fields.summary ?? '',
          description: issue.fields.description ?? '',
          status: { name: issue.fields.status?.name ?? 'Unknown' },
          issuetype: { name: issue.fields.issuetype?.name ?? 'Unknown' },
          labels: issue.fields.labels || [],
          priority: issue.fields.priority?.name,
          assignee: issue.fields.assignee?.displayName,
          updated: issue.fields.updated,
          created: issue.fields.created,
        },
      }));

      logger.info(`Found ${issues.length} similar Jira issues for: ${testName || searchTerms.join(' ')}`);
      return issues;
    } catch (error) {
      logger.error('Failed to search Jira for similar issues:', error);
      return [];
    }
  }

  /**
   * Extract meaningful search terms from an error message.
   * Strips noise like timestamps, UUIDs, memory addresses, and line numbers.
   */
  private extractSearchTerms(errorMessage: string): string[] {
    let cleaned = errorMessage
      // Remove timestamps
      .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*Z?/g, '')
      // Remove UUIDs
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '')
      // Remove memory addresses
      .replace(/0x[0-9a-f]+/gi, '')
      // Remove file paths with line numbers
      .replace(/\(\/[^)]+:\d+:\d+\)/g, '')
      // Remove standalone numbers
      .replace(/\b\d{4,}\b/g, '')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim();

    // Take the first meaningful portion (JQL text search has limits)
    if (cleaned.length > 200) {
      cleaned = cleaned.substring(0, 200);
    }

    return cleaned ? [cleaned] : [];
  }

  /**
   * Escape special JQL characters
   */
  private escapeJql(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'");
  }

  /**
   * Check if Jira integration is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  async transitionIssue(issueKey: string, status: JiraIssueStatus): Promise<void> {
    this.checkEnabled();

    try {
      // Get available transitions
      const transitions = await withResilience(
        () => this.client!.listTransitions(issueKey),
        JIRA_RESILIENCE,
      );

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
      await withResilience(
        () => this.client!.transitionIssue(issueKey, { transition: { id: targetTransition.id } }),
        JIRA_RESILIENCE,
      );

      logger.info(`Transitioned Jira issue ${issueKey} to ${status}`);
    } catch (error) {
      logger.error(`Failed to transition Jira issue ${issueKey}:`, error);
      throw new Error('Failed to transition Jira issue');
    }
  }

  /**
   * Add a comment to a Jira issue.
   */
  async addComment(issueKey: string, body: string): Promise<void> {
    this.checkEnabled();

    try {
      await withResilience(
        () => this.client!.addComment(issueKey, { body }),
        JIRA_RESILIENCE,
      );
      logger.info(`Added comment to Jira issue ${issueKey}`);
    } catch (error) {
      logger.error(`Failed to add comment to ${issueKey}:`, error);
      throw new Error('Failed to add comment to Jira issue');
    }
  }

  /**
   * Link two Jira issues with a relationship type.
   * Sprint 7: Autonomous housekeeping — Tier 1 auto-execute.
   */
  async linkIssues(sourceKey: string, targetKey: string, linkType: string = 'relates to'): Promise<void> {
    this.checkEnabled();

    try {
      // jira-client types don't expose issueLink, but the REST API supports it
      await withResilience(
        () => this.client!.issueLink({
          type: { name: linkType },
          inwardIssue: { key: sourceKey },
          outwardIssue: { key: targetKey },
        }),
        JIRA_RESILIENCE,
      );
      logger.info(`Linked Jira issues ${sourceKey} → ${targetKey} (${linkType})`);
    } catch (error) {
      logger.error(`Failed to link ${sourceKey} to ${targetKey}:`, error);
      throw new Error(`Failed to link Jira issues: ${sourceKey} → ${targetKey}`);
    }
  }

  /**
   * Add labels to a Jira issue.
   * Sprint 7: Autonomous housekeeping — Tier 1 auto-execute.
   */
  async addLabels(issueKey: string, labels: string[]): Promise<void> {
    this.checkEnabled();

    try {
      // Use the Jira REST API 'update' field operator for atomic label additions
      await withResilience(
        () => this.client!.updateIssue(issueKey, {
          fields: {},
          update: {
            labels: labels.map(label => ({ add: label })),
          },
        }),
        JIRA_RESILIENCE,
      );
      logger.info(`Added labels [${labels.join(', ')}] to ${issueKey}`);
    } catch (error) {
      logger.error(`Failed to add labels to ${issueKey}:`, error);
      throw new Error(`Failed to add labels to ${issueKey}`);
    }
  }
}

export const jiraService = new JiraService();
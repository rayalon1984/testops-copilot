import axios, { AxiosInstance } from 'axios';
import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';
import { config } from '@/config';
import { validateUrlForSSRF } from '@/utils/ssrf-validator';
import { withResilience, circuitBreakers } from '@/lib/resilience';
import { buildRCAContent, buildTestReportContent } from './confluence-formatters';

const CONFLUENCE_RESILIENCE = {
  circuitBreaker: circuitBreakers.confluence,
  retry: { maxRetries: 2, baseDelayMs: 1000 },
  timeoutMs: 10_000,
  label: 'confluence',
};

// Confluence API Types
export interface ConfluenceConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
  spaceKey?: string;
  parentPageId?: string;
}

export interface ConfluencePage {
  id: string;
  type: string;
  status: string;
  title: string;
  space: {
    key: string;
  };
  version: {
    number: number;
  };
  body: {
    storage: {
      value: string;
      representation: string;
    };
  };
  _links: {
    webui: string;
    self: string;
  };
}

export interface CreatePageRequest {
  type: string;
  title: string;
  space: {
    key: string;
  };
  body: {
    storage: {
      value: string;
      representation: string;
    };
  };
  ancestors?: Array<{ id: string }>;
}

export interface UpdatePageRequest {
  version: {
    number: number;
  };
  title: string;
  type: string;
  body: {
    storage: {
      value: string;
      representation: string;
    };
  };
}

export interface RCADocumentOptions {
  spaceKey?: string;
  parentPageId?: string;
  addLabels?: string[];
  linkToJira?: boolean;
}

export interface TestReportOptions {
  spaceKey?: string;
  parentPageId?: string;
  addLabels?: string[];
  includeFailureDetails?: boolean;
}

export class ConfluenceService {
  private client: AxiosInstance | null = null;
  private spaceKey: string = '';
  private parentPageId: string | undefined;
  private enabled: boolean = false;

  constructor() {
    if (!config.confluence) {
      logger.warn('Confluence integration is not configured. Confluence features will be disabled.');
      this.enabled = false;
      return;
    }

    try {
      validateUrlForSSRF(config.confluence.baseUrl);

      const auth = Buffer.from(
        `${config.confluence.username}:${config.confluence.apiToken}`
      ).toString('base64');

      this.client = axios.create({
        baseURL: `${config.confluence.baseUrl}/wiki/rest/api`,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 30000,
      });

      this.spaceKey = config.confluence.spaceKey || '';
      this.parentPageId = config.confluence.parentPageId;
      this.enabled = true;
      logger.info('Confluence integration initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Confluence client:', error);
      this.enabled = false;
    }
  }

  private checkEnabled() {
    if (!this.enabled || !this.client) {
      throw new Error('Confluence integration is not enabled or configured');
    }
  }

  async validateConnection(): Promise<boolean> {
    this.checkEnabled();

    try {
      const response = await withResilience(
        () => this.client!.get('/space'),
        CONFLUENCE_RESILIENCE,
      );
      logger.info('Confluence connection validated successfully');
      return response.status === 200;
    } catch (error) {
      logger.error('Confluence connection validation failed:', error);
      throw new Error('Failed to connect to Confluence');
    }
  }

  /**
   * Get space by key
   */
  async getSpace(spaceKey?: string): Promise<unknown> {
    this.checkEnabled();

    const key = spaceKey || this.spaceKey;
    if (!key) {
      throw new Error('Space key is required');
    }

    try {
      const response = await withResilience(
        () => this.client!.get(`/space/${key}`),
        CONFLUENCE_RESILIENCE,
      );
      return response.data;
    } catch (error) {
      logger.error(`Failed to get Confluence space ${key}:`, error);
      throw new Error('Failed to get Confluence space');
    }
  }

  async createPage(
    title: string,
    content: string,
    spaceKey?: string,
    parentPageId?: string
  ): Promise<ConfluencePage> {
    this.checkEnabled();

    const space = spaceKey || this.spaceKey;
    if (!space) {
      throw new Error('Space key is required');
    }

    try {
      const pageData: CreatePageRequest = {
        type: 'page',
        title,
        space: { key: space },
        body: {
          storage: {
            value: content,
            representation: 'storage',
          },
        },
      };

      const parent = parentPageId || this.parentPageId;
      if (parent) {
        pageData.ancestors = [{ id: parent }];
      }

      const response = await withResilience(
        () => this.client!.post('/content', pageData),
        CONFLUENCE_RESILIENCE,
      );
      const page: ConfluencePage = response.data;

      logger.info(`Created Confluence page: ${page.id} (${page.title})`);
      return page;
    } catch (error) {
      logger.error('Failed to create Confluence page:', error);
      throw new Error('Failed to create Confluence page');
    }
  }

  async updatePage(
    pageId: string,
    title: string,
    content: string,
    currentVersion: number
  ): Promise<ConfluencePage> {
    this.checkEnabled();

    try {
      const updateData: UpdatePageRequest = {
        version: {
          number: currentVersion + 1,
        },
        title,
        type: 'page',
        body: {
          storage: {
            value: content,
            representation: 'storage',
          },
        },
      };

      const response = await withResilience(
        () => this.client!.put(`/content/${pageId}`, updateData),
        CONFLUENCE_RESILIENCE,
      );
      logger.info(`Updated Confluence page: ${pageId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to update Confluence page ${pageId}:`, error);
      throw new Error('Failed to update Confluence page');
    }
  }

  /**
   * Get page by ID
   */
  async getPage(pageId: string): Promise<ConfluencePage> {
    this.checkEnabled();

    try {
      const response = await withResilience(
        () => this.client!.get(`/content/${pageId}`, {
          params: { expand: 'body.storage,version,space' },
        }),
        CONFLUENCE_RESILIENCE,
      );
      return response.data;
    } catch (error) {
      logger.error(`Failed to get Confluence page ${pageId}:`, error);
      throw new Error('Failed to get Confluence page');
    }
  }

  /**
   * Search for a page by title
   */
  async findPageByTitle(title: string, spaceKey?: string): Promise<ConfluencePage | null> {
    this.checkEnabled();

    const space = spaceKey || this.spaceKey;
    if (!space) {
      throw new Error('Space key is required');
    }

    try {
      const response = await withResilience(
        () => this.client!.get('/content', {
          params: { spaceKey: space, title: title, expand: 'body.storage,version,space' },
        }),
        CONFLUENCE_RESILIENCE,
      );

      const pages = response.data.results;
      return pages.length > 0 ? pages[0] : null;
    } catch (error) {
      logger.error(`Failed to search for Confluence page:`, error);
      return null;
    }
  }

  async addLabels(pageId: string, labels: string[]): Promise<void> {
    this.checkEnabled();

    try {
      await Promise.all(
        labels.map(label =>
          withResilience(
            () => this.client!.post(`/content/${pageId}/label`, { prefix: 'global', name: label }),
            CONFLUENCE_RESILIENCE,
          )
        )
      );
      logger.info(`Added ${labels.length} labels to page ${pageId}`);
    } catch (error) {
      logger.error(`Failed to add labels to page ${pageId}:`, error);
      // Don't throw - labels are optional
    }
  }

  /**
   * Publish RCA documentation from Failure Archive
   */
  async publishRCADocument(
    failureArchiveId: string,
    options: RCADocumentOptions = {}
  ): Promise<string> {
    this.checkEnabled();

    try {
      // Get failure archive entry
      const failure = await prisma.failureArchive.findUnique({
        where: { id: failureArchiveId },
        // include: { jiraIssue: true } // Removed
      });

      if (!failure) {
        throw new Error('Failure archive entry not found');
      }

      if (!failure.rootCause) {
        throw new Error('No RCA documentation available for this failure');
      }

      // Generate page title
      const date = new Date(failure.lastOccurrence).toISOString().split('T')[0];
      const title = `RCA: ${failure.testName} - ${date}`;

      // Build Confluence content in storage format
      const content = buildRCAContent(failure, options.linkToJira !== false);

      // Check if page already exists
      const existingPage = await this.findPageByTitle(
        title,
        options.spaceKey || this.spaceKey
      );

      let page: ConfluencePage;
      if (existingPage) {
        // Update existing page
        page = await this.updatePage(
          existingPage.id,
          title,
          content,
          existingPage.version.number
        );
      } else {
        // Create new page
        page = await this.createPage(
          title,
          content,
          options.spaceKey || this.spaceKey,
          options.parentPageId || this.parentPageId
        );
      }

      // Add labels
      const labels = [
        'rca',
        'test-failure',
        (failure.severity || 'info').toLowerCase(),
        ...(options.addLabels || []),
      ];
      await this.addLabels(page.id, labels);

      // Store the mapping
      await prisma.confluencePage.create({
        data: {
          pageId: page.id,
          title: page.title,
          spaceKey: page.space.key,
          url: `${config.confluence!.baseUrl}/wiki${page._links.webui}`,
          // sourceId: failureArchiveId, // Removed
          metadata: JSON.stringify({
            version: page.version.number,
            type: 'rca_document',
            sourceId: failureArchiveId // Moved to metadata
          })
        },
      });

      logger.info(`Published RCA document for failure ${failureArchiveId}: ${page.id}`);
      return `${config.confluence!.baseUrl}/wiki${page._links.webui}`;
    } catch (error) {
      logger.error(`Failed to publish RCA document:`, error);
      throw new Error('Failed to publish RCA document to Confluence');
    }
  }

  /**
   * Publish test execution report
   */
  async publishTestReport(
    testRunId: string,
    options: TestReportOptions = {}
  ): Promise<string> {
    this.checkEnabled();

    try {
      // Get test run with results
      // Get test run with results
      const testRun = await prisma.testRun.findUnique({
        where: { id: testRunId },
        include: {
          pipeline: true,
          results: true, // Renamed from testResults
          user: true,
        },
      });

      if (!testRun) {
        throw new Error('Test run not found');
      }

      // Generate page title
      const date = new Date(testRun.createdAt).toISOString().split('T')[0];
      const title = `Test Report: ${testRun.pipeline.name} - ${date}`;

      // Build Confluence content
      const content = buildTestReportContent(testRun, options.includeFailureDetails !== false);

      // Create page
      const page = await this.createPage(
        title,
        content,
        options.spaceKey || this.spaceKey,
        options.parentPageId || this.parentPageId
      );

      // Add labels
      // Note: testRun.status is an enum in Prod, so toString() or cast needed if strict config? 
      // TestStatus enum values match valid labels generally.
      const statusLabel = typeof testRun.status === 'string' ? testRun.status.toLowerCase() : String(testRun.status).toLowerCase();
      const labels = [
        'test-report',
        'automated-tests',
        statusLabel,
        ...(options.addLabels || []),
      ];
      await this.addLabels(page.id, labels);

      // Store the mapping
      await prisma.confluencePage.create({
        data: {
          pageId: page.id,
          title: page.title,
          spaceKey: page.space.key,
          url: `${config.confluence!.baseUrl}/wiki${page._links.webui}`,
          // sourceId: testRunId, // Removed as not in Prod schema
          metadata: JSON.stringify({
            version: page.version.number,
            type: 'test_report',
            sourceId: testRunId // Stored in metadata
          })
        },
      });

      logger.info(`Published test report for run ${testRunId}: ${page.id}`);
      return `${config.confluence!.baseUrl}/wiki${page._links.webui}`;
    } catch (error) {
      logger.error(`Failed to publish test report:`, error);
      throw new Error('Failed to publish test report to Confluence');
    }
  }

  /**
   * Search Confluence for pages relevant to a test failure.
   * Uses CQL (Confluence Query Language) to find RCA docs, runbooks, and architecture pages.
   */
  async searchContent(
    query: string,
    options: { spaceKey?: string; maxResults?: number; labels?: string[] } = {}
  ): Promise<Array<{ id: string; title: string; url: string; excerpt: string; labels: string[] }>> {
    this.checkEnabled();

    const space = options.spaceKey || this.spaceKey;
    const maxResults = options.maxResults || 10;

    try {
      // Build CQL query
      let cql = `type = page AND text ~ "${this.escapeCql(query)}"`;
      if (space) {
        cql += ` AND space = "${space}"`;
      }
      if (options.labels && options.labels.length > 0) {
        const labelClauses = options.labels.map(l => `label = "${l}"`).join(' OR ');
        cql += ` AND (${labelClauses})`;
      }
      cql += ' ORDER BY lastModified DESC';

      const response = await withResilience(
        () => this.client!.get('/content/search', {
          params: { cql, limit: maxResults, expand: 'body.view,metadata.labels,space' },
        }),
        CONFLUENCE_RESILIENCE,
      );

      const results = (response.data.results || []).map((page: { id: string; title: string; body?: { view?: { value?: string } }; metadata?: { labels?: { results?: Array<{ name: string }> } }; _links?: { webui?: string } }) => {
        // Extract a text excerpt from the page body (strip HTML)
        const bodyHtml = page.body?.view?.value || '';
        const excerpt = this.stripHtml(bodyHtml).substring(0, 500);
        const labels = (page.metadata?.labels?.results || []).map((l: { name: string }) => l.name);

        return {
          id: page.id,
          title: page.title,
          url: `${config.confluence!.baseUrl}/wiki${page._links?.webui || ''}`,
          excerpt,
          labels,
        };
      });

      logger.info(`Found ${results.length} Confluence pages for query: ${query.substring(0, 50)}`);
      return results;
    } catch (error) {
      logger.error('Failed to search Confluence:', error);
      return [];
    }
  }

  /**
   * Get the full text content of a Confluence page (HTML stripped to plain text).
   */
  async getPageContent(pageId: string): Promise<{ title: string; content: string; url: string }> {
    this.checkEnabled();

    try {
      const page = await this.getPage(pageId);
      const content = this.stripHtml(page.body?.storage?.value || '');

      return {
        title: page.title,
        content,
        url: `${config.confluence!.baseUrl}/wiki${page._links?.webui || ''}`,
      };
    } catch (error) {
      logger.error(`Failed to get Confluence page content ${pageId}:`, error);
      throw new Error('Failed to get Confluence page content');
    }
  }

  /**
   * Strip HTML tags and return plain text
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .trim();
  }

  private escapeCql(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

// Export singleton instance
export const confluenceService = new ConfluenceService();

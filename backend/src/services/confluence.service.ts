import axios, { AxiosInstance } from 'axios';
import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';
import { config } from '@/config';
import { validateUrlForSSRF } from '@/utils/ssrf-validator';

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

  /**
   * Validate Confluence connection
   */
  async validateConnection(): Promise<boolean> {
    this.checkEnabled();

    try {
      const response = await this.client!.get('/space');
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
  async getSpace(spaceKey?: string): Promise<any> {
    this.checkEnabled();

    const key = spaceKey || this.spaceKey;
    if (!key) {
      throw new Error('Space key is required');
    }

    try {
      const response = await this.client!.get(`/space/${key}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get Confluence space ${key}:`, error);
      throw new Error('Failed to get Confluence space');
    }
  }

  /**
   * Create a new page
   */
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

      const response = await this.client!.post('/content', pageData);
      const page: ConfluencePage = response.data;

      logger.info(`Created Confluence page: ${page.id} (${page.title})`);
      return page;
    } catch (error) {
      logger.error('Failed to create Confluence page:', error);
      throw new Error('Failed to create Confluence page');
    }
  }

  /**
   * Update an existing page
   */
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

      const response = await this.client!.put(`/content/${pageId}`, updateData);
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
      const response = await this.client!.get(`/content/${pageId}`, {
        params: {
          expand: 'body.storage,version,space',
        },
      });
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
      const response = await this.client!.get('/content', {
        params: {
          spaceKey: space,
          title: title,
          expand: 'body.storage,version,space',
        },
      });

      const pages = response.data.results;
      return pages.length > 0 ? pages[0] : null;
    } catch (error) {
      logger.error(`Failed to search for Confluence page:`, error);
      return null;
    }
  }

  /**
   * Add labels to a page
   */
  async addLabels(pageId: string, labels: string[]): Promise<void> {
    this.checkEnabled();

    try {
      await Promise.all(
        labels.map(label =>
          this.client!.post(`/content/${pageId}/label`, {
            prefix: 'global',
            name: label,
          })
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
      const content = this.buildRCAContent(failure, options.linkToJira !== false);

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
          metadata: {
            version: page.version.number,
            type: 'rca_document',
            sourceId: failureArchiveId // Moved to metadata
          } as any
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
      const content = this.buildTestReportContent(testRun, options.includeFailureDetails !== false);

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
          metadata: {
            version: page.version.number,
            type: 'test_report',
            sourceId: testRunId // Stored in metadata
          } as any
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

      const response = await this.client!.get('/content/search', {
        params: {
          cql,
          limit: maxResults,
          expand: 'body.view,metadata.labels,space',
        },
      });

      const results = (response.data.results || []).map((page: any) => {
        // Extract a text excerpt from the page body (strip HTML)
        const bodyHtml = page.body?.view?.value || '';
        const excerpt = this.stripHtml(bodyHtml).substring(0, 500);
        const labels = (page.metadata?.labels?.results || []).map((l: any) => l.name);

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

  /**
   * Escape special CQL characters
   */
  private escapeCql(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
  }

  /**
   * Build RCA document content in Confluence storage format
   */
  private buildRCAContent(failure: any, linkToJira: boolean): string {
    let html = `
<h2>Root Cause Analysis</h2>
<p><strong>Test:</strong> ${this.escapeHtml(failure.testName)}</p>
<p><strong>Occurred At:</strong> ${new Date(failure.occurredAt).toLocaleString()}</p>
<p><strong>Severity:</strong> <ac:structured-macro ac:name="status" ac:schema-version="1">
  <ac:parameter ac:name="colour">${this.getSeverityColor(failure.severity)}</ac:parameter>
  <ac:parameter ac:name="title">${failure.severity}</ac:parameter>
</ac:structured-macro></p>
<p><strong>Status:</strong> ${failure.status}</p>

<h3>Failure Details</h3>
<p><strong>Error Message:</strong></p>
<div class="code panel"><div class="codeContent panelContent"><pre>${this.escapeHtml(failure.errorMessage)}</pre></div></div>
`;

    if (failure.stackTrace) {
      html += `
<p><strong>Stack Trace:</strong></p>
<ac:structured-macro ac:name="code" ac:schema-version="1">
  <ac:parameter ac:name="language">text</ac:parameter>
  <ac:plain-text-body><![CDATA[${failure.stackTrace}]]></ac:plain-text-body>
</ac:structured-macro>
`;
    }

    html += `
<h3>Root Cause</h3>
<p>${this.escapeHtml(failure.rootCause)}</p>
`;

    if (failure.detailedAnalysis) {
      html += `
<h3>Detailed Analysis</h3>
<p>${this.escapeHtml(failure.detailedAnalysis)}</p>
`;
    }

    if (failure.solution) {
      html += `
<h3>Solution</h3>
<p>${this.escapeHtml(failure.solution)}</p>
`;
    }

    if (failure.preventionSteps) {
      html += `
<h3>Prevention Steps</h3>
<p>${this.escapeHtml(failure.preventionSteps)}</p>
`;
    }

    if (failure.workaround) {
      html += `
<h3>Workaround</h3>
<p>${this.escapeHtml(failure.workaround)}</p>
`;
    }

    // Add metadata table
    html += `
<h3>Metadata</h3>
<table>
  <tr><th>Field</th><th>Value</th></tr>
  <tr><td>Environment</td><td>${failure.environment || 'N/A'}</td></tr>
  <tr><td>Build Number</td><td>${failure.buildNumber || 'N/A'}</td></tr>
  <tr><td>Branch</td><td>${failure.branch || 'N/A'}</td></tr>
  <tr><td>Commit SHA</td><td>${failure.commitSha || 'N/A'}</td></tr>
  <tr><td>Is Recurring</td><td>${failure.isRecurring ? 'Yes' : 'No'}</td></tr>
  <tr><td>Occurrence Count</td><td>${failure.occurrenceCount}</td></tr>
  ${failure.timeToResolve ? `<tr><td>Time to Resolve</td><td>${failure.timeToResolve} minutes</td></tr>` : ''}
</table>
`;

    // Link to Jira if applicable
    if (linkToJira && failure.jiraIssue) {
      html += `
<h3>Related Jira Issue</h3>
<p><a href="${config.jira?.baseUrl}/browse/${failure.jiraIssue.issueKey}">${failure.jiraIssue.issueKey}</a>: ${this.escapeHtml(failure.jiraIssue.summary)}</p>
`;
    }

    if (failure.tags && failure.tags.length > 0) {
      html += `
<h3>Tags</h3>
<p>${failure.tags.map((tag: string) => `<ac:link><ri:page ri:content-title="${tag}"/></ac:link>`).join(', ')}</p>
`;
    }

    return html;
  }

  /**
   * Build test report content
   */
  /**
   * Build test report content
   */
  private buildTestReportContent(testRun: any, includeFailureDetails: boolean): string {
    // Adapter for testResults vs testCases naming (Prisma model uses testResults)
    const cases = testRun.testResults || testRun.testCases || [];

    const totalTests = cases.length;
    const passedTests = cases.filter((tc: any) => tc.status === 'PASSED').length;
    const failedTests = cases.filter((tc: any) => tc.status === 'FAILED').length;
    const skippedTests = cases.filter((tc: any) => tc.status === 'SKIPPED').length;
    const passRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(2) : '0';

    let html = `
<h2>Test Execution Summary</h2>
<p><strong>Pipeline:</strong> ${this.escapeHtml(testRun.pipeline.name)}</p>
<p><strong>Executed At:</strong> ${new Date(testRun.createdAt).toLocaleString()}</p>
<p><strong>Status:</strong> <ac:structured-macro ac:name="status" ac:schema-version="1">
  <ac:parameter ac:name="colour">${this.getStatusColor(testRun.status)}</ac:parameter>
  <ac:parameter ac:name="title">${testRun.status}</ac:parameter>
</ac:structured-macro></p>
${testRun.branch ? `<p><strong>Branch:</strong> ${this.escapeHtml(testRun.branch)}</p>` : ''}
${testRun.commit ? `<p><strong>Commit:</strong> <code>${testRun.commit.substring(0, 8)}</code></p>` : ''}
${testRun.duration ? `<p><strong>Duration:</strong> ${this.formatDuration(testRun.duration)}</p>` : ''}

<h3>Test Results</h3>
<table>
  <tr><th>Metric</th><th>Value</th></tr>
  <tr><td>Total Tests</td><td>${totalTests}</td></tr>
  <tr><td>Passed</td><td><span style="color: green;">${passedTests}</span></td></tr>
  <tr><td>Failed</td><td><span style="color: red;">${failedTests}</span></td></tr>
  <tr><td>Skipped</td><td>${skippedTests}</td></tr>
  <tr><td>Pass Rate</td><td>${passRate}%</td></tr>
</table>
`;

    if (includeFailureDetails && failedTests > 0) {
      html += `
<h3>Failed Tests</h3>
<table>
  <tr><th>Test Name</th><th>Error</th><th>Duration</th></tr>
`;
      cases
        .filter((tc: any) => tc.status === 'FAILED')
        .forEach((tc: any) => {
          html += `
  <tr>
    <td>${this.escapeHtml(tc.testName || tc.name)}</td>
    <td>${this.escapeHtml(tc.error || tc.message || 'No error message')}</td>
    <td>${tc.duration ? `${tc.duration}ms` : 'N/A'}</td>
  </tr>
`;
        });
      html += `
</table>
`;
    }

    html += `
<p><em>Generated by TestOps Companion</em></p>
`;

    return html;
  }

  /**
   * Helper methods
   */
  private escapeHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private getSeverityColor(severity: string): string {
    const colors: { [key: string]: string } = {
      CRITICAL: 'Red',
      HIGH: 'Yellow',
      MEDIUM: 'Blue',
      LOW: 'Grey',
    };
    return colors[severity] || 'Grey';
  }

  private getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      PASSED: 'Green',
      SUCCESS: 'Green',
      FAILED: 'Red',
      FAILURE: 'Red',
      RUNNING: 'Blue',
      PENDING: 'Yellow',
      SKIPPED: 'Grey',
    };
    return colors[status] || 'Grey';
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Check if Confluence is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Export singleton instance
export const confluenceService = new ConfluenceService();

/**
 * Confluence API Types
 * Official API documentation: https://developer.atlassian.com/cloud/confluence/rest/v2/intro/
 */

export interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
  type: string;
  status: string;
  _links: {
    webui: string;
    self: string;
  };
}

export interface ConfluencePage {
  id: string;
  type: string;
  status: string;
  title: string;
  space: {
    id: string;
    key: string;
    name?: string;
  };
  version: {
    number: number;
    when: string;
    by: {
      displayName: string;
      email?: string;
    };
    message?: string;
  };
  body: {
    storage: {
      value: string;
      representation: string;
    };
    view?: {
      value: string;
      representation: string;
    };
  };
  ancestors?: Array<{
    id: string;
    type: string;
    title: string;
  }>;
  children?: {
    page: {
      results: ConfluencePage[];
    };
  };
  descendants?: {
    page: {
      results: ConfluencePage[];
    };
  };
  metadata?: {
    labels?: {
      results: ConfluenceLabel[];
    };
  };
  _links: {
    webui: string;
    self: string;
    tinyui: string;
    editui: string;
    base: string;
  };
  _expandable?: {
    [key: string]: string;
  };
}

export interface ConfluenceLabel {
  id: string;
  name: string;
  prefix: string;
}

export interface ConfluenceAttachment {
  id: string;
  type: string;
  status: string;
  title: string;
  extensions: {
    mediaType: string;
    fileSize: number;
    comment?: string;
  };
  metadata: {
    mediaType: string;
  };
  _links: {
    webui: string;
    download: string;
    self: string;
  };
}

export interface ConfluenceUser {
  type: string;
  accountId: string;
  email?: string;
  publicName: string;
  displayName: string;
  _links: {
    self: string;
  };
}

// Request DTOs
export interface CreatePageRequest {
  type: 'page' | 'blogpost';
  title: string;
  space: {
    key: string;
  };
  body: {
    storage: {
      value: string;
      representation: 'storage';
    };
  };
  ancestors?: Array<{
    id: string;
  }>;
  metadata?: {
    properties?: {
      [key: string]: unknown;
    };
  };
}

export interface UpdatePageRequest {
  version: {
    number: number;
    message?: string;
  };
  title: string;
  type: 'page' | 'blogpost';
  body: {
    storage: {
      value: string;
      representation: 'storage';
    };
  };
  metadata?: {
    properties?: {
      [key: string]: unknown;
    };
  };
}

export interface AddLabelRequest {
  prefix: 'global' | 'my' | 'team';
  name: string;
}

export interface SearchRequest {
  cql: string;
  cqlcontext?: string;
  excerpt?: 'indexed' | 'highlight' | 'none';
  expand?: string[];
  start?: number;
  limit?: number;
}

export interface SearchResponse {
  results: ConfluencePage[];
  start: number;
  limit: number;
  size: number;
  totalSize: number;
  _links: {
    base: string;
    context: string;
    self: string;
  };
}

// Custom types for our use cases
export interface RCADocumentOptions {
  spaceKey?: string;
  parentPageId?: string;
  addLabels?: string[];
  linkToJira?: boolean;
  includeScreenshots?: boolean;
  updateIfExists?: boolean;
}

export interface TestReportOptions {
  spaceKey?: string;
  parentPageId?: string;
  addLabels?: string[];
  includeFailureDetails?: boolean;
  includePassedTests?: boolean;
  includeTrendChart?: boolean;
  groupByStatus?: boolean;
}

export interface FailurePatternDocOptions {
  spaceKey?: string;
  parentPageId?: string;
  addLabels?: string[];
  includeRelatedRCAs?: boolean;
  includeRunbookSteps?: boolean;
}

export interface ConfluenceConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
  spaceKey?: string;
  parentPageId?: string;
  enabled?: boolean;
}

// Page content templates
export interface PageTemplate {
  title: string;
  content: string;
  labels?: string[];
  spaceKey?: string;
  parentPageId?: string;
}

// Confluence storage format helpers
export interface StorageFormatMacro {
  name: string;
  parameters?: {
    [key: string]: string;
  };
  body?: string;
}

export interface TableRow {
  header?: boolean;
  cells: string[];
}

export interface Table {
  headers?: string[];
  rows: TableRow[];
}

// Error response
export interface ConfluenceError {
  statusCode: number;
  data: {
    authorized: boolean;
    valid: boolean;
    errors: Array<{
      message: {
        key: string;
        args: unknown[];
      };
    }>;
    successful: boolean;
  };
  message: string;
}

// Publish result
export interface PublishResult {
  success: boolean;
  pageId?: string;
  pageUrl?: string;
  error?: string;
  action: 'created' | 'updated' | 'skipped';
}

// Bulk publish options
export interface BulkPublishOptions {
  spaceKey?: string;
  parentPageId?: string;
  addLabels?: string[];
  overwriteExisting?: boolean;
  generateIndex?: boolean;
}

export interface BulkPublishResult {
  successful: number;
  failed: number;
  skipped: number;
  results: PublishResult[];
  indexPageUrl?: string;
}

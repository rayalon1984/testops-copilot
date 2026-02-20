// Fallback Prisma types when client generation fails
// These match the schema.prisma enums

export enum UserRole {
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
  BILLING = 'BILLING',
  USER = 'USER'
}

export enum PipelineType {
  JENKINS = 'JENKINS',
  GITHUB_ACTIONS = 'GITHUB_ACTIONS',
  CUSTOM = 'CUSTOM'
}

export enum PipelineStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  CANCELLED = 'CANCELLED',
  TIMEOUT = 'TIMEOUT'
}

export enum TestStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  ERROR = 'ERROR'
}

export enum TestResult {
  PASS = 'PASS',
  FAIL = 'FAIL',
  SKIP = 'SKIP',
  ERROR = 'ERROR'
}

export enum NotificationType {
  EMAIL = 'EMAIL',
  SLACK = 'SLACK',
  PUSHOVER = 'PUSHOVER'
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED'
}

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

// Prisma namespace with minimal types
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Prisma {
  export type InputJsonValue = string | number | boolean | null | InputJsonObject | InputJsonArray;
  export type InputJsonObject = { [key: string]: InputJsonValue };
  export type InputJsonArray = InputJsonValue[];
  export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
  export type JsonObject = { [key: string]: JsonValue };
  export type JsonArray = JsonValue[];

  export interface PipelineCreateInput {
    id?: string;
    name: string;
    type: PipelineType;
    config: InputJsonValue;
    status?: PipelineStatus;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    user: {
      connect: {
        id: string;
      };
    };
    testRuns?: Record<string, unknown>;
    jiraIssues?: Record<string, unknown>;
  }

  export interface PipelineUpdateInput {
    name?: string;
    type?: PipelineType;
    config?: InputJsonValue;
    status?: PipelineStatus;
    updatedAt?: Date | string;
    user?: Record<string, unknown>;
    testRuns?: Record<string, unknown>;
    jiraIssues?: Record<string, unknown>;
  }
}

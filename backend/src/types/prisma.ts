// Temporary type definitions until Prisma generates them

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  USER = 'USER',
}

export enum PipelineType {
  JENKINS = 'JENKINS',
  GITHUB_ACTIONS = 'GITHUB_ACTIONS',
  GITLAB_CI = 'GITLAB_CI',
  CUSTOM = 'CUSTOM',
}

export enum PipelineStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ARCHIVED = 'ARCHIVED',
}

export enum TestStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum TestResult {
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  FLAKY = 'FLAKY',
  SKIPPED = 'SKIPPED',
  BLOCKED = 'BLOCKED',
}

export enum NotificationType {
  PIPELINE_STATUS = 'PIPELINE_STATUS',
  TEST_FAILURE = 'TEST_FAILURE',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  MAINTENANCE = 'MAINTENANCE',
}

export enum NotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
  ARCHIVED = 'ARCHIVED',
}
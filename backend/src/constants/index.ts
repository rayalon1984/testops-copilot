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
  FLAKY = 'FLAKY',
  ERROR = 'ERROR' // Keeping ERROR for now but FLAKY is preferred
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

export const JWT_CONFIG = {
  algorithm: 'HS256',
  issuer: 'testops-companion',
  audience: 'testops-companion-client'
} as const;

export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Forbidden access',
  NOT_FOUND: 'Resource not found',
  VALIDATION_ERROR: 'Validation error',
  INTERNAL_ERROR: 'Internal server error',
  TOKEN_EXPIRED: 'Token has expired',
  INVALID_TOKEN: 'Invalid token',
  INVALID_CREDENTIALS: 'Invalid credentials'
} as const;

export const API_ROUTES = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me'
  },
  PIPELINES: '/pipelines',
  TEST_RUNS: '/test-runs',
  NOTIFICATIONS: '/notifications',
  JIRA: '/jira'
} as const;
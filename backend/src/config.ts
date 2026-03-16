import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables.
// Fallback chain: .env (user/production overrides) > .env.dev (local dev defaults, gitignored).
// New devs: cp .env.dev.example .env.dev to get started.
// dotenv v16+ processes the array in order; first file's values win for any given key.
// Real environment variables (Docker, CI) always take precedence over file values.
dotenv.config({ path: ['.env', '.env.dev'] });

// Environment variables schema
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('4000'),

  // API
  API_PREFIX: z.string().default('/api/v1'),

  // CORS — comma-separated for multiple origins (e.g. "https://app.example.com,https://admin.example.com")
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

  // Database
  DATABASE_URL: z.string(),
  DATABASE_SSL: z.string().transform(val => val === 'true').default('false'),
  DATABASE_POOL_SIZE: z.string().transform(Number).default('10'),
  DATABASE_POOL_TIMEOUT: z.string().transform(Number).default('10'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters for production security'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters for production security'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // GitHub (optional)
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_API_URL: z.string().default('https://api.github.com'),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),

  // Jira (optional)
  JIRA_BASE_URL: z.string().optional(),
  JIRA_EMAIL: z.string().optional(),
  JIRA_API_TOKEN: z.string().optional(),
  JIRA_PROJECT_KEY: z.string().optional(),
  JIRA_DEFAULT_ISSUE_TYPE: z.string().default('Bug'),
  JIRA_DEBUG: z.string().transform(val => val === 'true').default('false'),

  // TestRail (optional)
  TESTRAIL_BASE_URL: z.string().optional(),
  TESTRAIL_USERNAME: z.string().optional(),
  TESTRAIL_API_KEY: z.string().optional(),
  TESTRAIL_PROJECT_ID: z.string().transform(Number).optional(),

  // Confluence (optional)
  CONFLUENCE_BASE_URL: z.string().optional(),
  CONFLUENCE_USERNAME: z.string().optional(),
  CONFLUENCE_API_TOKEN: z.string().optional(),
  CONFLUENCE_SPACE_KEY: z.string().optional(),
  CONFLUENCE_PARENT_PAGE_ID: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['combined', 'common', 'dev', 'short', 'tiny']).default('combined'),

  // Security
  BCRYPT_SALT_ROUNDS: z.string().transform(Number).default('12'),
  SECURE_COOKIE: z.string().transform(val => val === 'true').default('false'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  CSRF_SECRET: z.string().min(32, 'CSRF_SECRET must be at least 32 characters').default('csrf-dev-secret-change-in-production-32chars'),

  // Redis
  REDIS_ENABLED: z.string().transform(val => val === 'true').default('false'),
  REDIS_MODE: z.enum(['standalone', 'cluster', 'sentinel']).default('standalone'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform(Number).default('0'),
  REDIS_NODES: z.string().optional(), // Comma separated host:port for cluster/sentinel
  REDIS_MASTER_NAME: z.string().optional(), // For sentinel

  // OpenTelemetry
  OTEL_ENABLED: z.string().transform(val => val === 'true').default('false'),
  OTEL_SERVICE_NAME: z.string().default('testops-copilot-backend'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://localhost:4318/v1/traces'),

  // SSO
  SSO_ENABLED: z.string().transform(val => val === 'true').default('false'),
  SAML_ENTRY_POINT: z.string().optional(),
  SAML_ISSUER: z.string().optional(),
  SAML_CERT: z.string().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  OIDC_ISSUER: z.string().optional(),

  // Slack
  SLACK_WEBHOOK_URL: z.string().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  SLACK_CHANNEL: z.string().optional(),
  SLACK_APP_TOKEN: z.string().optional(), // xapp-... for Socket Mode / Events API

  // Email
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.string().transform(Number).optional(),
  EMAIL_SECURE: z.string().transform(val => val === 'true').optional(),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_RECIPIENTS: z.string().optional(),

  // Pushover
  PUSHOVER_USER_KEY: z.string().optional(),
  PUSHOVER_APP_TOKEN: z.string().optional(),

  // AI
  AI_PROVIDER: z.enum(['openai', 'anthropic', 'bedrock', 'mock']).default('mock'),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),

  // AWS Bedrock
  AWS_BEDROCK_REGION: z.string().optional(),
  AWS_BEDROCK_ACCESS_KEY_ID: z.string().optional(),
  AWS_BEDROCK_SECRET_ACCESS_KEY: z.string().optional(),

  // Microsoft Teams
  TEAMS_APP_ID: z.string().optional(),
  TEAMS_APP_PASSWORD: z.string().optional(),

  // Xray Cloud (optional)
  XRAY_CLIENT_ID: z.string().optional(),
  XRAY_CLIENT_SECRET: z.string().optional(),
  XRAY_PROJECT_KEY: z.string().optional(),
  XRAY_CLOUD_URL: z.string().url().optional().default('https://xray.cloud.getxray.app'),
  XRAY_AUTO_SYNC: z.string().transform(val => val === 'true').default('false'),

  // Azure DevOps (optional)
  AZDO_ORG_URL: z.string().optional(),
  AZDO_PAT: z.string().optional(),
  AZDO_PROJECT: z.string().optional(),
  AZDO_TEAM: z.string().optional(),

  // CI Integration (optional)
  CI_API_TOKEN: z.string().optional(),
});

// Parse and validate environment variables
const env = envSchema.parse(process.env);

/**
 * Append Prisma connection pool parameters to a PostgreSQL DATABASE_URL.
 * SQLite / file-based URLs are returned as-is (pool params don't apply).
 */
export function buildDatabaseUrl(
  baseUrl: string,
  poolSize: number,
  poolTimeout: number,
): string {
  // Only apply pool params to PostgreSQL URLs
  if (!baseUrl.startsWith('postgresql://') && !baseUrl.startsWith('postgres://')) {
    return baseUrl;
  }

  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}connection_limit=${poolSize}&pool_timeout=${poolTimeout}`;
}

/**
 * Parse CORS_ORIGIN into a single string or array of origins.
 * Supports comma-separated values for multi-frontend deployments.
 */
export function parseCorsOrigin(raw: string): string | string[] {
  const origins = raw.split(',').map(s => s.trim()).filter(Boolean);
  return origins.length === 1 ? origins[0] : origins;
}

// Export configuration object
export interface GitHubConfig {
  token?: string;
  apiUrl: string;
  webhookSecret?: string;
}

export interface Config {
  env: string;
  port: number;
  api: {
    prefix: string;
  };
  cors: {
    origin: string | string[];
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  database: {
    url: string;
    ssl: boolean;
    poolSize: number;
    poolTimeout: number;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  github: GitHubConfig;
  jira?: {
    baseUrl: string;
    email: string;
    apiToken: string;
    projectKey: string;
    defaultIssueType: string;
    debug: boolean;
  };
  testrail?: {
    baseUrl: string;
    username: string;
    apiKey: string;
    projectId?: number;
  };
  confluence?: {
    baseUrl: string;
    username: string;
    apiToken: string;
    spaceKey?: string;
    parentPageId?: string;
  };
  log: {
    level: string;
    format: string;
  };
  security: {
    bcryptSaltRounds: number;
    secureCookie: boolean;
    sessionSecret: string;
    csrfSecret: string;
  };
  redis: {
    enabled: boolean;
    mode: 'standalone' | 'cluster' | 'sentinel';
    host: string;
    port: number;
    password?: string;
    db: number;
    nodes: string[];
    masterName?: string;
  };
  otel: {
    enabled: boolean;
    serviceName: string;
    exporterEndpoint: string;
  };
  sso: {
    enabled: boolean;
    saml?: {
      entryPoint: string;
      issuer: string;
      cert: string;
    };
    oidc?: {
      clientId: string;
      clientSecret: string;
      issuer: string;
    };
  };
  notifications: {
    slack?: {
      webhookUrl: string;
      botToken: string;
      signingSecret: string;
      channel: string;
    };
    email?: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      password: string;
      from: string;
      recipients: string[];
    };
    pushover?: {
      userKey: string;
      appToken: string;
    };
  };
  xray?: {
    clientId: string;
    clientSecret: string;
    projectKey: string;
    cloudUrl: string;
    autoSync: boolean;
  };
  azureDevOps?: {
    orgUrl: string;
    pat: string;
    project: string;
    team?: string;
  };
  ai: {
    provider: 'openai' | 'anthropic' | 'bedrock' | 'mock';
    apiKey: string;
    model: string;
  };
}

export const config: Config = {
  env: env.NODE_ENV,
  port: env.PORT,
  api: {
    prefix: env.API_PREFIX,
  },
  cors: {
    origin: parseCorsOrigin(env.CORS_ORIGIN),
  },
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },
  database: {
    url: buildDatabaseUrl(env.DATABASE_URL, env.DATABASE_POOL_SIZE, env.DATABASE_POOL_TIMEOUT),
    ssl: env.DATABASE_SSL,
    poolSize: env.DATABASE_POOL_SIZE,
    poolTimeout: env.DATABASE_POOL_TIMEOUT,
  },
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
  ...(env.JIRA_BASE_URL && env.JIRA_API_TOKEN && env.JIRA_PROJECT_KEY && {
    jira: {
      baseUrl: env.JIRA_BASE_URL,
      email: env.JIRA_EMAIL || '',
      apiToken: env.JIRA_API_TOKEN,
      projectKey: env.JIRA_PROJECT_KEY,
      defaultIssueType: env.JIRA_DEFAULT_ISSUE_TYPE,
      debug: env.JIRA_DEBUG,
    },
  }),
  ...(env.TESTRAIL_BASE_URL && env.TESTRAIL_USERNAME && env.TESTRAIL_API_KEY && {
    testrail: {
      baseUrl: env.TESTRAIL_BASE_URL,
      username: env.TESTRAIL_USERNAME,
      apiKey: env.TESTRAIL_API_KEY,
      projectId: env.TESTRAIL_PROJECT_ID,
    },
  }),
  ...(env.XRAY_CLIENT_ID && env.XRAY_CLIENT_SECRET && env.XRAY_PROJECT_KEY && {
    xray: {
      clientId: env.XRAY_CLIENT_ID,
      clientSecret: env.XRAY_CLIENT_SECRET,
      projectKey: env.XRAY_PROJECT_KEY,
      cloudUrl: env.XRAY_CLOUD_URL,
      autoSync: env.XRAY_AUTO_SYNC,
    },
  }),
  ...(env.CONFLUENCE_BASE_URL && env.CONFLUENCE_USERNAME && env.CONFLUENCE_API_TOKEN && {
    confluence: {
      baseUrl: env.CONFLUENCE_BASE_URL,
      username: env.CONFLUENCE_USERNAME,
      apiToken: env.CONFLUENCE_API_TOKEN,
      spaceKey: env.CONFLUENCE_SPACE_KEY,
      parentPageId: env.CONFLUENCE_PARENT_PAGE_ID,
    },
  }),
  ...(env.AZDO_ORG_URL && env.AZDO_PAT && env.AZDO_PROJECT && {
    azureDevOps: {
      orgUrl: env.AZDO_ORG_URL,
      pat: env.AZDO_PAT,
      project: env.AZDO_PROJECT,
      team: env.AZDO_TEAM,
    },
  }),
  github: {
    token: env.GITHUB_TOKEN,
    apiUrl: env.GITHUB_API_URL,
    webhookSecret: env.GITHUB_WEBHOOK_SECRET,
  },
  log: {
    level: env.LOG_LEVEL,
    format: env.LOG_FORMAT,
  },
  security: {
    bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
    secureCookie: env.SECURE_COOKIE,
    sessionSecret: env.SESSION_SECRET,
    csrfSecret: env.CSRF_SECRET,
  },
  redis: {
    enabled: env.REDIS_ENABLED,
    mode: env.REDIS_MODE,
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    db: env.REDIS_DB,
    nodes: env.REDIS_NODES ? env.REDIS_NODES.split(',') : [],
    masterName: env.REDIS_MASTER_NAME,
  },
  otel: {
    enabled: env.OTEL_ENABLED,
    serviceName: env.OTEL_SERVICE_NAME,
    exporterEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  },
  sso: {
    enabled: env.SSO_ENABLED,
    ...(env.SAML_ENTRY_POINT && env.SAML_ISSUER && env.SAML_CERT && {
      saml: {
        entryPoint: env.SAML_ENTRY_POINT,
        issuer: env.SAML_ISSUER,
        cert: env.SAML_CERT,
      },
    }),
    ...(env.OIDC_CLIENT_ID && env.OIDC_CLIENT_SECRET && env.OIDC_ISSUER && {
      oidc: {
        clientId: env.OIDC_CLIENT_ID,
        clientSecret: env.OIDC_CLIENT_SECRET,
        issuer: env.OIDC_ISSUER,
      },
    }),
  },
  notifications: {
    ...(env.SLACK_BOT_TOKEN && {
      slack: {
        webhookUrl: env.SLACK_WEBHOOK_URL!,
        botToken: env.SLACK_BOT_TOKEN,
        signingSecret: env.SLACK_SIGNING_SECRET!,
        channel: env.SLACK_CHANNEL!,
      },
    }),
    ...(env.EMAIL_HOST && {
      email: {
        host: env.EMAIL_HOST,
        port: env.EMAIL_PORT!,
        secure: env.EMAIL_SECURE!,
        user: env.EMAIL_USER!,
        password: env.EMAIL_PASSWORD!,
        from: env.EMAIL_FROM!,
        recipients: env.EMAIL_RECIPIENTS?.split(',') || [],
      },
    }),
    ...(env.PUSHOVER_APP_TOKEN && {
      pushover: {
        userKey: env.PUSHOVER_USER_KEY!,
        appToken: env.PUSHOVER_APP_TOKEN,
      },
    }),
  },
  ai: {
    provider: env.AI_PROVIDER as 'openai' | 'anthropic' | 'bedrock' | 'mock',
    apiKey: env.AI_API_KEY || 'demo-key',
    model: env.AI_MODEL || 'gpt-4o',
  },
};
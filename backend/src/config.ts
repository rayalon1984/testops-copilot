import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Environment variables schema
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  
  // API
  API_PREFIX: z.string().default('/api/v1'),
  
  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  
  // Database
  DATABASE_URL: z.string(),
  DATABASE_SSL: z.string().transform(val => val === 'true').default('false'),
  
  // JWT
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_REFRESH_SECRET: z.string(),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // GitHub (optional)
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_API_URL: z.string().default('https://api.github.com'),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),

  // Jira (optional)
  JIRA_BASE_URL: z.string().optional(),
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
  SESSION_SECRET: z.string().optional(),

  // Slack
  SLACK_WEBHOOK_URL: z.string().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  SLACK_CHANNEL: z.string().optional(),

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
});

// Parse and validate environment variables
const env = envSchema.parse(process.env);

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
    origin: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  database: {
    url: string;
    ssl: boolean;
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
    sessionSecret?: string;
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
}

export const config: Config = {
  env: env.NODE_ENV,
  port: env.PORT,
  api: {
    prefix: env.API_PREFIX,
  },
  cors: {
    origin: env.CORS_ORIGIN,
  },
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },
  database: {
    url: env.DATABASE_URL,
    ssl: env.DATABASE_SSL,
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
  ...(env.CONFLUENCE_BASE_URL && env.CONFLUENCE_USERNAME && env.CONFLUENCE_API_TOKEN && {
    confluence: {
      baseUrl: env.CONFLUENCE_BASE_URL,
      username: env.CONFLUENCE_USERNAME,
      apiToken: env.CONFLUENCE_API_TOKEN,
      spaceKey: env.CONFLUENCE_SPACE_KEY,
      parentPageId: env.CONFLUENCE_PARENT_PAGE_ID,
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
};
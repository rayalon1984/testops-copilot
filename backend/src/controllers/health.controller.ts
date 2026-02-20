import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import Redis from 'ioredis';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: ServiceStatus;
    redis?: ServiceStatus;
    weaviate?: ServiceStatus;
    ai?: ServiceStatus;
  };
  environment: {
    nodeEnv: string;
    nodeVersion: string;
    port: number;
  };
}

interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Basic health check endpoint
 * Returns simple status for load balancers
 */
export async function healthCheck(req: Request, res: Response): Promise<void> {
  try {
    // Simple database ping
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Service unavailable'
    });
  }
}

/**
 * Comprehensive health check endpoint
 * Returns detailed status of all services
 */
export async function healthCheckFull(req: Request, res: Response): Promise<void> {
  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '2.5.6',
    uptime: process.uptime(),
    services: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      weaviate: await checkWeaviate(),
      ai: await checkAI()
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      port: parseInt(process.env.PORT || '3000', 10)
    }
  };

  // Determine overall status
  const services = Object.values(result.services);
  const hasDown = services.some(s => s?.status === 'down');
  const hasDegraded = services.some(s => s?.status === 'degraded');

  if (hasDown) {
    result.status = 'unhealthy';
  } else if (hasDegraded) {
    result.status = 'degraded';
  }

  // Return appropriate status code
  const statusCode = result.status === 'healthy' ? 200 :
    result.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json(result);
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<ServiceStatus> {
  const startTime = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;

    // Get database info
    const userCount = await prisma.user.count();

    return {
      status: 'up',
      responseTime,
      details: {
        users: userCount,
        provider: 'postgresql'
      }
    };
  } catch (error: unknown) {
    return {
      status: 'down',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check Redis connectivity
 */
async function checkRedis(): Promise<ServiceStatus | undefined> {
  // Skip if Redis is not configured
  if (!process.env.REDIS_URL) {
    return undefined;
  }

  const startTime = Date.now();

  try {
    // const { default: Redis } = await import('ioredis');
    const redis = new Redis(process.env.REDIS_URL as string);

    await redis.ping();
    const responseTime = Date.now() - startTime;

    await redis.quit();

    return {
      status: 'up',
      responseTime
    };
  } catch (error: unknown) {
    return {
      status: 'down',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check Weaviate connectivity
 */
async function checkWeaviate(): Promise<ServiceStatus | undefined> {
  // Skip if Weaviate is not configured
  if (!process.env.WEAVIATE_URL || process.env.AI_ENABLED !== 'true') {
    return undefined;
  }

  const startTime = Date.now();

  try {
    const response = await fetch(`${process.env.WEAVIATE_URL}/v1/.well-known/ready`);
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return {
        status: 'up',
        responseTime
      };
    } else {
      return {
        status: 'down',
        responseTime,
        error: `HTTP ${response.status}`
      };
    }
  } catch (error: unknown) {
    return {
      status: 'down',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check AI provider connectivity
 */
async function checkAI(): Promise<ServiceStatus | undefined> {
  // Skip if AI is not enabled
  if (process.env.AI_ENABLED !== 'true') {
    return undefined;
  }

  const provider = process.env.AI_PROVIDER || 'anthropic';
  const startTime = Date.now();

  try {
    let hasApiKey = false;

    switch (provider) {
      case 'anthropic':
        hasApiKey = !!process.env.ANTHROPIC_API_KEY;
        break;
      case 'openai':
        hasApiKey = !!process.env.OPENAI_API_KEY;
        break;
      case 'google':
        hasApiKey = !!process.env.GOOGLE_API_KEY;
        break;
      case 'azure':
        hasApiKey = !!process.env.AZURE_OPENAI_KEY;
        break;
    }

    if (!hasApiKey) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        error: `No API key configured for ${provider}`,
        details: { provider }
      };
    }

    return {
      status: 'up',
      responseTime: Date.now() - startTime,
      details: {
        provider,
        configured: true
      }
    };
  } catch (error: unknown) {
    return {
      status: 'down',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: { provider }
    };
  }
}

/**
 * Readiness check - are we ready to serve traffic?
 */
export async function readinessCheck(req: Request, res: Response): Promise<void> {
  try {
    // Must be able to connect to database
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      ready: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      error: 'Database not ready'
    });
  }
}

/**
 * Liveness check - is the application alive?
 */
export async function livenessCheck(req: Request, res: Response): Promise<void> {
  // Simple check - if we can respond, we're alive
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
}

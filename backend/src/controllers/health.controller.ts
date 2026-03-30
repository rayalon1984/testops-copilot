import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { getAllCircuitBreakerStatuses, type CircuitBreakerStatus } from '../lib/resilience';
import { githubSyncService } from '../services/github-sync.service';

/** Run a promise with a timeout; resolves to false on timeout */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) =>
      setTimeout(() => reject(new Error(`Health check timed out after ${ms}ms`)), ms),
    ),
  ]);
}

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
  githubSync: { running: boolean; lastSyncAt: Date | null; mode: string };
  circuitBreakers: CircuitBreakerStatus[];
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
    githubSync: githubSyncService.getStatus(),
    circuitBreakers: getAllCircuitBreakerStatuses(),
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
  const hasOpenBreaker = result.circuitBreakers.some(cb => cb.state === 'OPEN');

  if (hasDown) {
    result.status = 'unhealthy';
  } else if (hasDegraded || hasOpenBreaker) {
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
    await withTimeout(prisma.$queryRaw`SELECT 1`, 3000);
    return {
      status: 'up',
      responseTime: Date.now() - startTime,
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
 * Check Redis connectivity using the shared singleton
 */
async function checkRedis(): Promise<ServiceStatus | undefined> {
  // Skip if Redis is not connected
  if (redis.status !== 'ready') {
    return undefined;
  }

  const startTime = Date.now();

  try {
    await withTimeout(redis.ping(), 3000);
    return {
      status: 'up',
      responseTime: Date.now() - startTime,
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
 * Readiness check — are we ready to serve traffic?
 * Checks DB (required) and Redis (when enabled).
 * Returns 200 OK or 503 Service Unavailable.
 */
export async function readinessCheck(_req: Request, res: Response): Promise<void> {
  const checks: Record<string, { status: string; error?: string }> = {};
  let healthy = true;

  // Database — always required
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 3000);
    checks.database = { status: 'up' };
  } catch (error) {
    checks.database = { status: 'down', error: error instanceof Error ? error.message : 'Unknown error' };
    healthy = false;
  }

  // Redis — only when connected
  if (redis.status === 'ready') {
    try {
      await withTimeout(redis.ping(), 3000);
      checks.redis = { status: 'up' };
    } catch (error) {
      checks.redis = { status: 'down', error: error instanceof Error ? error.message : 'Unknown error' };
      healthy = false;
    }
  }

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  });
}

/**
 * Liveness check - is the application alive?
 */
export async function livenessCheck(_req: Request, res: Response): Promise<void> {
  // Simple check - if we can respond, we're alive
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
}

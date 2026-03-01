import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import session from 'express-session';
import passport from 'passport';
import { config } from './config';
import { logger } from './utils/logger';
import './services/passport.service'; // Initialize passport
import { errorHandler } from './middleware/errorHandler';
import { doubleCsrfProtection, csrfTokenHandler } from './middleware/csrf';
import { registerRoutes } from './routes';
import { ApiError } from './types/error';
import { asMiddleware } from './types/middleware';

// Type augmentation for express Request
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      startTime?: number;
      requestId?: string;
    }
  }
}

const app: Application = express();

// Security middleware
app.use(asMiddleware(helmet()));
app.use(asMiddleware(cors({
  origin: config.cors.origin,
  credentials: true
})));

// Dev/demo mode flag — used by rate limiters below
const isDev = process.env.NODE_ENV !== 'production';

// Rate limiting - global
// Dev/demo: 1000 req / 15 min (mock provider has zero cost — don't throttle demos)
// Production: 100 req / 15 min (protects real AI provider budget)
const rateLimitMiddleware = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: isDev ? 1000 : config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      status: 'error',
      message: 'Too many requests'
    });
  }
});

// Stricter rate limiting for auth endpoints
// Dev/demo: 100 req / 15 min (avoids lockouts during testing)
// Production: 10 req / 15 min (brute-force protection)
const authRateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      status: 'error',
      message: 'Too many authentication attempts, please try again later'
    });
  }
});

app.use(asMiddleware(rateLimitMiddleware));
app.use('/api/v1/auth/login', asMiddleware(authRateLimitMiddleware));
app.use('/api/v1/auth/register', asMiddleware(authRateLimitMiddleware));

// Body parsing middleware
// Preserve raw body for Slack signature verification on channel webhook routes
app.use(asMiddleware(express.json({
  limit: '1mb',
  verify: (req: Request & { rawBody?: string }, _res, buf) => {
    if (req.originalUrl?.startsWith('/api/v1/channels/')) {
      req.rawBody = buf.toString('utf-8');
    }
  },
})));
app.use(asMiddleware(express.urlencoded({ extended: true, limit: '1mb' })));
app.use(asMiddleware(compression()));
app.use(asMiddleware(cookieParser()));

import { redis } from './lib/redis';

// Workaround for TS resolution issue with connect-redis v9 in CommonJS env
// eslint-disable-next-line @typescript-eslint/no-var-requires
const RedisStore = require('connect-redis').RedisStore;

// Session configuration — RedisStore for production, graceful fallback to MemoryStore
const sessionConfig: session.SessionOptions = {
  secret: config.security.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.security.secureCookie,
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
};

// Use RedisStore when Redis is available (production); MemoryStore fallback for local dev
if (redis.status === 'ready' || redis.status === 'connecting') {
  sessionConfig.store = new RedisStore({ client: redis });
} else {
  logger.warn('[Session] Redis unavailable — using in-memory session store. Sessions will not persist across restarts. CSRF protection is unaffected (stateless double-submit cookie).');
}

app.use(session(sessionConfig));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// CSRF protection (double-submit cookie pattern)
app.get('/api/v1/csrf-token', csrfTokenHandler);
app.use(asMiddleware(doubleCsrfProtection));

// Request ID / correlation ID (early — before timing and routes)
import { requestIdMiddleware } from './middleware/requestId';
app.use(requestIdMiddleware);

// Request timing middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.startTime = Date.now();
  next();
});

// Response time recording for Prometheus p95/p99 metrics
import { recordResponseTime } from './middleware/responseTime';
app.use(recordResponseTime);

// Health check endpoints (no auth required)
import { livenessCheck, readinessCheck } from './controllers/health.controller';
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});
app.get('/health/live', livenessCheck);
app.get('/health/ready', readinessCheck);

// Register API routes
registerRoutes(app);

import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

// Swagger UI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Error handling middleware
app.use((err: Error | ApiError, req: Request, res: Response, _next: NextFunction) => {
  const apiError = err instanceof ApiError
    ? err
    : new ApiError(500, err.message || 'Internal Server Error');
  errorHandler(apiError, req, res);
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: 'Resource not found'
  });
});

export default app;
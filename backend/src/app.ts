import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import session from 'express-session';
import passport from 'passport';
import { config } from './config';
import './services/passport.service'; // Initialize passport
import { errorHandler } from './middleware/errorHandler';
import { registerRoutes } from './routes';
import { ApiError } from './types/error';
import { asMiddleware } from './types/middleware';

// Type augmentation for express Request
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      startTime?: number;
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

// Rate limiting - global
const rateLimitMiddleware = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      status: 'error',
      message: 'Too many requests'
    });
  }
});

// Stricter rate limiting for auth endpoints (10 requests per 15 minutes)
const authRateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
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


// import { redis } from './lib/redis';

// Workaround for TS resolution issue with connect-redis v9 in CommonJS env
// eslint-disable-next-line @typescript-eslint/no-var-requires
const _RedisStore = require('connect-redis').RedisStore as unknown;

// Session configuration
app.use(session({
  // store: new RedisStore({ client: redis }), // Disabled for demo/simple mode without Docker
  secret: config.security.sessionSecret || 'default_secret', // Should be in env
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.security.secureCookie,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Request timing middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.startTime = Date.now();
  next();
});

// Response time recording for Prometheus p95/p99 metrics
import { recordResponseTime } from './middleware/responseTime';
app.use(recordResponseTime);

// Health check endpoint (no sensitive system info)
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

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
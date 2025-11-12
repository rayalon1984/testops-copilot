import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import { config } from './config';
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

// Rate limiting
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

app.use(asMiddleware(rateLimitMiddleware));

// Body parsing middleware
app.use(asMiddleware(express.json()));
app.use(asMiddleware(express.urlencoded({ extended: true })));
app.use(asMiddleware(compression()));

// Request timing middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.startTime = Date.now();
  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage()
  });
});

// Register API routes
registerRoutes(app);

// Error handling middleware
app.use((err: Error | ApiError, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ApiError) {
    errorHandler(err, req, res, next);
  } else {
    // Convert regular Error to ApiError with 500 status code
    const apiError = new ApiError(500, err.message || 'Internal Server Error');
    errorHandler(apiError, req, res, next);
  }
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: 'Resource not found'
  });
});

export default app;
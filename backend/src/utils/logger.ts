import winston from 'winston';
import { config } from '@/config';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

const transports = [
  new winston.transports.Console(),
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  new winston.transports.File({ filename: 'logs/all.log' }),
];

export const logger = winston.createLogger({
  level: config.log.level,
  levels,
  format,
  transports,
});

// If we're not in production, log to the console with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest })`
if (config.env !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
  );
}

// Create a stream object with a write function that will be used by Morgan
export const stream = {
  write: (message: string): void => {
    logger.http(message.trim());
  },
};

// Export type for type checking
export type Logger = typeof logger;

// Extend Error to include optional status code
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error handling utility functions
export const handleError = (err: Error | AppError): void => {
  logger.error('Error:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    statusCode: (err as AppError).statusCode,
    isOperational: (err as AppError).isOperational,
  });

  // If error is not operational, exit process
  if (!(err as AppError).isOperational) {
    process.exit(1);
  }
};

// Uncaught exception handler
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// Unhandled rejection handler
process.on('unhandledRejection', (err: Error) => {
  logger.error('Unhandled Rejection:', err);
  process.exit(1);
});
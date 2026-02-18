import app from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { prisma } from './lib/prisma';

import { initializeAI } from './services/ai/manager';

async function startServer() {
  try {
    // Connect to database
    await prisma.$connect();
    logger.info('Connected to database');

    // Initialize AI Services (Mock DB for SQLite/Demo mode)
    // CostTracker expects a PG Pool, but we are using SQLite for demo.
    // We mock the pool to prevent crashes.
    const mockDbPool = {
      query: async () => ({ rows: [] }),
      connect: async () => ({ release: () => { } }),
      on: () => { },
      end: async () => { },
    } as any;

    try {
      await initializeAI({ db: mockDbPool });
      logger.info('AI Services initialized');
    } catch (aiError) {
      logger.warn('Failed to initialize AI services (non-critical for basic app):', aiError);
    }

    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`Server is running on port ${config.port}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`API Base URL: ${config.api.prefix}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down server...');

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await prisma.$disconnect();
          logger.info('Database connection closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during database disconnect:', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
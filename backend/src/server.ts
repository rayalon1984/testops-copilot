import app from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { prisma } from './lib/prisma';

async function startServer() {
  try {
    // Connect to database
    await prisma.$connect();
    logger.info('Connected to database');

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
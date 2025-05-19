import { Sequelize } from 'sequelize';
import { config } from '@/config';
import { logger } from '@/utils/logger';

// Create Sequelize instance
export const sequelize = new Sequelize(config.database.url, {
  dialect: 'postgres',
  logging: (msg: string) => logger.debug(msg),
  ssl: config.database.ssl,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Test database connection
export const connectDatabase = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection has been established successfully.');

    // Sync models with database
    if (config.env !== 'production') {
      await sequelize.sync({ alter: true });
      logger.info('Database models synchronized.');
    }

  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    throw error;
  }
};

// Close database connection
export const closeDatabase = async (): Promise<void> => {
  try {
    await sequelize.close();
    logger.info('Database connection closed.');
  } catch (error) {
    logger.error('Error closing database connection:', error);
    throw error;
  }
};

// Initialize models
import './models/user.model';

// Export database instance
export const getDatabase = (): Sequelize => sequelize;
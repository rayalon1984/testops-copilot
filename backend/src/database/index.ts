import { Sequelize } from 'sequelize';
import { config } from '@/config';
import { logger } from '@/utils/logger';

// Create Sequelize instance (only for production/non-dev environments)
// In dev mode (dev:simple), we use Prisma with SQLite instead
let databaseUrl = config.database.url || 'sqlite::memory:';
let dialect: 'postgres' | 'sqlite' = 'sqlite';

// Convert Prisma SQLite URL to Sequelize format
if (databaseUrl.startsWith('file:')) {
  // Extract the file path from Prisma format (file:./prisma/dev.db -> ./prisma/dev.db)
  const filePath = databaseUrl.replace('file:', '');
  databaseUrl = `sqlite:${filePath}`;
  dialect = 'sqlite';
} else if (databaseUrl.startsWith('postgres')) {
  dialect = 'postgres';
}

export const sequelize = new Sequelize(databaseUrl, {
  dialect,
  logging: (msg: string) => logger.debug(msg),
  ssl: dialect === 'postgres' ? config.database.ssl : false,
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
// import './models/user.model'; // Commented out for dev mode with Prisma

// Export database instance
export const getDatabase = (): Sequelize => sequelize;
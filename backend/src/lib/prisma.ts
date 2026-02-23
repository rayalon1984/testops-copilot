import { PrismaClient } from '@prisma/client';
import { config } from '../config';

// Prevent multiple instances of Prisma Client in development
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    datasources: { db: { url: config.database.url } },
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}